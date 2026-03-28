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

  let body: {
    room_id?: string;
    player_token?: string;
    round_id?: string;
    result_status?: string;
    result_detail?: string;
    error_code?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "invalid_json" }, 400);
  }

  if (!body.room_id || !body.player_token || !body.round_id || !body.result_status) {
    return jsonRes(
      { error: "need_room_id_player_token_round_id_result_status" },
      400,
    );
  }

  const allowed = ["ok", "skipped", "error"];
  if (!allowed.includes(body.result_status)) {
    return jsonRes({ error: "invalid_result_status", allowed }, 400);
  }

  const supabase = serviceClient();
  const hash = await sha256Hex(body.player_token);

  const { data: player, error: pErr } = await supabase
    .from("room_players")
    .select("id")
    .eq("room_id", body.room_id)
    .eq("player_token_hash", hash)
    .maybeSingle();

  if (pErr || !player) {
    return jsonRes({ error: "player_not_in_room" }, 403);
  }

  const { data: round, error: rErr } = await supabase
    .from("rounds")
    .select("id, victim_player_id, status")
    .eq("id", body.round_id)
    .eq("room_id", body.room_id)
    .single();

  if (rErr || !round) {
    return jsonRes({ error: "round_not_found" }, 404);
  }
  if (round.victim_player_id !== player.id) {
    return jsonRes({ error: "only_victim_can_submit" }, 403);
  }
  if (round.status !== "assigned") {
    return jsonRes({ error: "round_already_finalized", status: round.status }, 400);
  }

  const statusMap: Record<string, string> = {
    ok: "completed",
    skipped: "skipped",
    error: "failed",
  };
  const newStatus = statusMap[body.result_status]!;

  const { error: uErr } = await supabase
    .from("rounds")
    .update({
      status: newStatus,
      result_status: body.result_status,
      result_detail: body.result_detail ?? null,
      error_code: body.error_code ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", body.round_id);

  if (uErr) {
    console.error(uErr);
    return jsonRes({ error: "update_failed", detail: uErr.message }, 500);
  }

  await supabase
    .from("rooms")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", body.room_id);

  return jsonRes({ ok: true, round_id: body.round_id, status: newStatus });
});
