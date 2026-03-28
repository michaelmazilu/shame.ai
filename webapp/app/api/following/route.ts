import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { getFollowing } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { count = 50, exclude = [], maxId = null } = await req.json();
  const excludeSet = new Set<string>(exclude);

  try {
    const collected: { id: string; username: string; fullName?: string; profilePic?: string }[] = [];
    let cursor: string | null = maxId;
    let pages = 0;
    const maxPages = 5;

    while (collected.length < count && pages < maxPages) {
      const result = await getFollowing(igSession, igSession.userId, cursor);
      for (const u of result.users) {
        if (!excludeSet.has(u.id) && collected.length < count) {
          collected.push(u);
        }
      }
      cursor = result.nextMaxId;
      pages++;
      if (!result.hasMore) break;
    }

    return NextResponse.json({
      profiles: collected,
      nextMaxId: cursor,
      hasMore: !!cursor,
    });
  } catch (e) {
    console.error("[API] Following fetch failed:", e);
    return NextResponse.json({ error: "Failed to load following" }, { status: 500 });
  }
}
