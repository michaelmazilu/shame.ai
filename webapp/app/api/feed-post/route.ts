import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { uploadPhoto, publishPost } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { imageB64, caption } = await req.json();
  if (!imageB64) {
    return NextResponse.json({ error: "imageB64 required" }, { status: 400 });
  }

  try {
    const bytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));

    // Step 1: Upload the image
    const upload = await uploadPhoto(igSession, bytes.buffer);
    if (!upload.success || !upload.uploadId) {
      return NextResponse.json({
        success: false,
        error: upload.error || "Upload failed",
      });
    }

    // Step 2: Publish as a feed post
    const result = await publishPost(igSession, upload.uploadId, caption || "");
    return NextResponse.json({
      success: result.success,
      mediaId: result.mediaId,
    });
  } catch (e) {
    console.error("[API] Feed post failed:", e);
    return NextResponse.json({ error: "Feed post failed" }, { status: 500 });
  }
}
