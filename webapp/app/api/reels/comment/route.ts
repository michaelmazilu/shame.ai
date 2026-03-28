import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { getRandomReel, commentOnPost } from "@/lib/instagram";
import { generateReelComment } from "@/lib/ai-gen";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  try {
    // Find a random reel
    const reel = await getRandomReel(igSession);
    if (!reel) {
      return NextResponse.json({ error: "No reels found" }, { status: 404 });
    }

    // Generate an AI comment
    const commentText = await generateReelComment(
      reel.caption,
      reel.username || undefined,
    );

    // Post the comment
    const result = await commentOnPost(igSession, reel.mediaId, commentText);

    return NextResponse.json({
      success: result.success,
      reel: { shortcode: reel.shortcode, username: reel.username },
      comment: commentText,
    });
  } catch (e) {
    console.error("[API] Reel comment failed:", e);
    return NextResponse.json(
      { error: "Failed to comment on reel" },
      { status: 500 },
    );
  }
}
