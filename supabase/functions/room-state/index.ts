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

  const { data: player, error: pErr } = await supabase
    .from("room_players")
    .select("id, role, display_name, ig_username, last_seen_at")
    .eq("room_id", body.room_id)
    .eq("player_token_hash", hash)
    .maybeSingle();

  if (pErr || !player) {
    return jsonRes({ error: "player_not_in_room" }, 403);
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, short_code, status, created_at")
    .eq("id", body.room_id)
    .single();

  const { data: players } = await supabase
    .from("room_players")
    .select("id, role, display_name, ig_username, last_seen_at, joined_at")
    .eq("room_id", body.room_id)
    .order("joined_at", { ascending: true });

  const { data: rounds } = await supabase
    .from("rounds")
    .select(
      "id, round_index, victim_player_id, deed, status, result_status, result_detail, error_code, created_at, completed_at",
    )
    .eq("room_id", body.room_id)
    .order("round_index", { ascending: false })
    .limit(50);

  const latestRound = rounds?.[0] ?? null;

  return jsonRes({
    room,
    you: player,
    players: players ?? [],
    latest_round: latestRound,
    rounds: rounds ?? [],
  });
});
