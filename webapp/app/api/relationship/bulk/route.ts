import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { checkRelationshipBulk } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { userIds } = await req.json();
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "userIds array required" }, { status: 400 });
  }

  try {
    const result = await checkRelationshipBulk(igSession, userIds);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[API] Bulk relationship check failed:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
