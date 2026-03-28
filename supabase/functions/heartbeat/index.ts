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

  let body: { room_id?: string; player_token?: string };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "invalid_json" }, 400);
  }

  if (!body.room_id || !body.player_token) {
    return jsonRes({ error: "need_room_id_and_player_token" }, 400);
  }

  const supabase = serviceClient();
  const hash = await sha256Hex(body.player_token);

  const { data: row, error } = await supabase
    .from("room_players")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("room_id", body.room_id)
    .eq("player_token_hash", hash)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(error);
    return jsonRes({ error: "heartbeat_failed", detail: error.message }, 500);
  }
  if (!row) {
    return jsonRes({ error: "player_not_in_room" }, 404);
  }

  await supabase
    .from("rooms")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", body.room_id);

  return jsonRes({ ok: true, player_id: row.id });
});
