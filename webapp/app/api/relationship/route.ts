import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { checkRelationship } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const result = await checkRelationship(igSession, userId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[API] Relationship check failed:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
