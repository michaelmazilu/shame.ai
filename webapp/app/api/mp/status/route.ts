import { NextResponse } from "next/server";
import { getMpServerEnv } from "@/lib/mp-server-env";

export const runtime = "nodejs";

/** GET — multiplayer proxy env (no secret values; booleans only). */
export async function GET() {
  const { url, key } = getMpServerEnv();
  const hasUrl = !!url;
  const hasKey = !!key;
  const ok = hasUrl && hasKey;
  if (!ok) {
    return NextResponse.json(
      { ok: false, hasUrl, hasKey },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, hasUrl, hasKey });
}
