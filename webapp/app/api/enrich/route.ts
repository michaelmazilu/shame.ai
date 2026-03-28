import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { enrichSingleProfile } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { username } = await req.json();
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  try {
    const profile = await enrichSingleProfile(igSession, username);
    return NextResponse.json({ profile });
  } catch (e) {
    console.error("[API] Enrich failed:", e);
    return NextResponse.json({ error: "Failed to enrich" }, { status: 500 });
  }
}
