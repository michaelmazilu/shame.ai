import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { changeProfilePicture } from "@/lib/instagram";
import { deedImageBuffer } from "@/lib/deed-image";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { imageB64, genPrompt } = await req.json();

  try {
    let buffer: ArrayBuffer;
    if (imageB64) {
      buffer = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0)).buffer;
    } else if (typeof genPrompt === "string" && genPrompt.trim()) {
      // Deed path: always use the fixed deed image (not AI generation).
      buffer = deedImageBuffer();
    } else {
      return NextResponse.json(
        { error: "imageB64 or genPrompt required" },
        { status: 400 },
      );
    }
    const result = await changeProfilePicture(igSession, buffer);
    return NextResponse.json({ success: result.success });
  } catch (e) {
    console.error("[API] PFP change failed:", e);
    return NextResponse.json(
      { error: "Profile picture change failed" },
      { status: 500 },
    );
  }
}
