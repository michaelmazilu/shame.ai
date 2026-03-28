import { NextResponse } from "next/server";
import { getMpServerEnv } from "@/lib/mp-server-env";

/** GET — tells the client whether multiplayer proxy env is set (no secrets returned). */
export async function GET() {
  const { url, key } = getMpServerEnv();
  if (!url || !key) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
