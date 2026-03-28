import { NextRequest, NextResponse } from "next/server";
import { hydrateInstagramUsername, verifyCheckpoint } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { code, checkpointUrl, username, cookies, csrfToken } = await req.json();

  if (!code || !checkpointUrl || !username) {
    return NextResponse.json({ error: "Missing checkpoint fields" }, { status: 400 });
  }

  const result = await verifyCheckpoint(code, checkpointUrl, username, cookies, csrfToken);

  if (!result.success || !result.session) {
    return NextResponse.json({ error: result.error || "Verification failed" }, { status: 401 });
  }

  const session = await getSession();
  session.ig = result.session;
  await hydrateInstagramUsername(result.session);
  await session.save();

  return NextResponse.json({
    success: true,
    userId: result.session.userId,
    username: result.session.username?.trim() || result.session.userId,
  });
}
