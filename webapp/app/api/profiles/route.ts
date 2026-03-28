import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { loadProfilePipeline } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { seen = [], sources = { suggested: true, explore: true, friendsOfFriends: true } } = await req.json();
  const seenSet = new Set<string>(seen);

  try {
    const profiles = await loadProfilePipeline(igSession, seenSet, sources);
    return NextResponse.json({ profiles });
  } catch (e) {
    console.error("[API] Profile loading failed:", e);
    return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
  }
}
