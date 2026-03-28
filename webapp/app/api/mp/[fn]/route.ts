import { NextRequest, NextResponse } from "next/server";
import { getMpServerEnv } from "@/lib/mp-server-env";

const ALLOWED = new Set([
  "create-room",
  "join-room",
  "heartbeat",
  "start-round",
  "submit-result",
  "room-state",
  "close-room",
]);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ fn: string }> },
) {
  const { fn } = await context.params;
  if (!ALLOWED.has(fn)) {
    return NextResponse.json({ error: "unknown_function" }, { status: 404 });
  }
  const { url, key } = getMpServerEnv();
  if (!url || !key) {
    return NextResponse.json(
      { error: "server_misconfigured", detail: "missing SUPABASE_URL or key" },
      { status: 503 },
    );
  }
  const body = await req.text();
  const upstream = await fetch(`${url}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: body || "{}",
  });
  const text = await upstream.text();
  const ct =
    upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": ct },
  });
}
