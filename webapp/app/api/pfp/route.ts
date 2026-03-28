import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { changeProfilePicture } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { imageB64 } = await req.json();
  if (!imageB64) {
    return NextResponse.json({ error: "imageB64 required" }, { status: 400 });
  }

  try {
    const bytes = Uint8Array.from(atob(imageB64), (c) => c.charCodeAt(0));
    const result = await changeProfilePicture(igSession, bytes.buffer);
    return NextResponse.json({ success: result.success });
  } catch (e) {
    console.error("[API] PFP change failed:", e);
    return NextResponse.json(
      { error: "Profile picture change failed" },
      { status: 500 },
    );
  }
}
