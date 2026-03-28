import { NextResponse } from "next/server";

function serverConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key };
}

/** GET — tells the client whether multiplayer proxy env is set (no secrets returned). */
export async function GET() {
  const { url, key } = serverConfig();
  if (!url || !key) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
