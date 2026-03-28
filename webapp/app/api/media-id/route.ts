import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { getMediaId } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { shortcode } = await req.json();
  if (!shortcode) {
    return NextResponse.json({ error: "shortcode required" }, { status: 400 });
  }

  try {
    const mediaId = await getMediaId(igSession, shortcode);
    if (!mediaId) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }
    return NextResponse.json({ mediaId });
  } catch (e) {
    console.error("[API] Media ID resolution failed:", e);
    return NextResponse.json({ error: "Failed to resolve media ID" }, { status: 500 });
  }
}
