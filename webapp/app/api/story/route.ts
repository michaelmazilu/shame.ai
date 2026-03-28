import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import {
  uploadStoryPhoto,
  uploadStoryVideo,
  repostReelToStory,
} from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case "photo": {
        // Upload base64 image as story
        const { imageB64 } = body;
        if (!imageB64) {
          return NextResponse.json(
            { error: "imageB64 required" },
            { status: 400 },
          );
        }
        const bytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
        const result = await uploadStoryPhoto(igSession, bytes.buffer);
        return NextResponse.json(result);
      }

      case "video": {
        // Upload base64 video as story
        const { videoB64 } = body;
        if (!videoB64) {
          return NextResponse.json(
            { error: "videoB64 required" },
            { status: 400 },
          );
        }
        const bytes = Uint8Array.from(atob(videoB64), (c) => c.charCodeAt(0));
        const result = await uploadStoryVideo(igSession, bytes.buffer);
        return NextResponse.json(result);
      }

      case "repost_reel": {
        // Repost a reel to story
        const { shortcode } = body;
        if (!shortcode) {
          return NextResponse.json(
            { error: "shortcode required" },
            { status: 400 },
          );
        }
        const result = await repostReelToStory(igSession, shortcode);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: "Invalid action. Use: photo, video, repost_reel" },
          { status: 400 },
        );
    }
  } catch (e) {
    console.error("[API] Story upload failed:", e);
    return NextResponse.json({ error: "Story upload failed" }, { status: 500 });
  }
}
