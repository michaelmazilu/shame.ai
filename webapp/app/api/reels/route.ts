import { NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { getRandomReel, getReelsFeed, getExploreReels } from "@/lib/instagram";

export async function POST() {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  try {
    const reel = await getRandomReel(igSession);
    if (!reel) {
      return NextResponse.json({ error: "No reels found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, reel });
  } catch (e) {
    console.error("[API] Reels fetch failed:", e);
    return NextResponse.json(
      { error: "Failed to fetch reels" },
      { status: 500 },
    );
  }
}
