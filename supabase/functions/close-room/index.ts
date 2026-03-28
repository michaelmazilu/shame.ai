import { corsHeaders, jsonRes } from "../../_shared/cors.ts";
import { sha256Hex } from "../../_shared/crypto.ts";
import { serviceClient } from "../../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "method_not_allowed" }, 405);
  }

  let body: { room_id?: string; host_secret?: string };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "invalid_json" }, 400);
  }

  if (!body.room_id || !body.host_secret) {
    return jsonRes({ error: "need_room_id_and_host_secret" }, 400);
  }

  const supabase = serviceClient();
  const host_hash = await sha256Hex(body.host_secret);

  const { data: room, error: rErr } = await supabase
    .from("rooms")
    .select("id, host_secret_hash, status")
    .eq("id", body.room_id)
    .single();

  if (rErr || !room) {
    return jsonRes({ error: "room_not_found" }, 404);
  }
  if (room.host_secret_hash !== host_hash) {
    return jsonRes({ error: "forbidden_invalid_host_secret" }, 403);
  }
  if (room.status === "closed") {
    return jsonRes({ error: "already_closed" }, 400);
  }

  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("rooms")
    .update({ status: "closed", closed_at: now, last_activity_at: now })
    .eq("id", body.room_id);

  if (uErr) {
    console.error(uErr);
    return jsonRes({ error: "close_failed", detail: uErr.message }, 500);
  }

  return jsonRes({ ok: true, room_id: body.room_id, status: "closed" });
});
