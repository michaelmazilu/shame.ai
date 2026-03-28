import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { followUser, unfollowUser } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { userId, action } = await req.json();
  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action required" }, { status: 400 });
  }

  try {
    const result = action === "unfollow"
      ? await unfollowUser(igSession, userId)
      : await followUser(igSession, userId);
    return NextResponse.json({ success: result.success });
  } catch (e) {
    console.error("[API] Follow action failed:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
