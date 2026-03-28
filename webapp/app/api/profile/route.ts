import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { getProfileInfo } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { username } = await req.json();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  try {
    const profile = await getProfileInfo(igSession, username);
    return NextResponse.json({ profile });
  } catch (e) {
    console.error("[API] Profile fetch failed:", e);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
