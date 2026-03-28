import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { sendDMGraphQL } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { userId, text } = await req.json();
  if (!userId || !text) {
    return NextResponse.json({ error: "userId and text required" }, { status: 400 });
  }

  try {
    const result = await sendDMGraphQL(igSession, userId, text);
    return NextResponse.json({ success: result.success });
  } catch (e) {
    console.error("[API] DM send failed:", e);
    return NextResponse.json({ error: "Failed to send DM" }, { status: 500 });
  }
}
