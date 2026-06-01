import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import {
  uploadStoryPhoto,
  uploadStoryVideo,
  repostReelToStory,
} from "@/lib/instagram";
import { deedImageBuffer } from "@/lib/deed-image";

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
        // Either an explicit base64 image, or a prompt to generate one.
        const { imageB64, genPrompt } = body;
        let buffer: ArrayBuffer;
        if (imageB64) {
          buffer = Uint8Array.from(atob(imageB64), (c) =>
            c.charCodeAt(0),
          ).buffer;
        } else if (typeof genPrompt === "string" && genPrompt.trim()) {
          // Deed path: always use the fixed deed image (not AI generation).
          buffer = deedImageBuffer();
        } else {
          return NextResponse.json(
            { error: "imageB64 or genPrompt required" },
            { status: 400 },
          );
        }
        const result = await uploadStoryPhoto(igSession, buffer);
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
