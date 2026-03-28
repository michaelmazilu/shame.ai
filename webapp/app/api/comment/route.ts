import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { commentOnPost } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { mediaId, text } = await req.json();
  if (!mediaId || !text) {
    return NextResponse.json({ error: "mediaId and text required" }, { status: 400 });
  }

  try {
    const result = await commentOnPost(igSession, mediaId, text);
    return NextResponse.json({ success: result.success, data: result.data });
  } catch (e) {
    console.error("[API] Comment failed:", e);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
