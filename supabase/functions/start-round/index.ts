import { corsHeaders, jsonRes } from "../../_shared/cors.ts";
import { sha256Hex } from "../../_shared/crypto.ts";
import { serviceClient } from "../../_shared/supabase.ts";

/** Players must have heartbeated within this window (host + guests). */
const READY_SECONDS = 180;

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const tw = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * tw;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i;
  }
  return items[items.length - 1]!;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

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
  if (room.status !== "open") {
    return jsonRes({ error: "room_closed" }, 400);
  }
  if (room.host_secret_hash !== host_hash) {
    return jsonRes({ error: "forbidden_invalid_host_secret" }, 403);
  }

  const cutoff = new Date(Date.now() - READY_SECONDS * 1000).toISOString();
  const { data: players, error: pErr } = await supabase
    .from("room_players")
    .select("id, last_seen_at, ig_username, display_name")
    .eq("room_id", body.room_id)
    .gte("last_seen_at", cutoff);

  if (pErr || !players?.length) {
    return jsonRes(
      {
        error: "no_eligible_players_ready",
        ready_within_seconds: READY_SECONDS,
      },
      400,
    );
  }

  const { data: templates, error: tErr } = await supabase
    .from("deed_templates")
    .select("id, deed_type, params, weight");

  if (tErr || !templates?.length) {
    return jsonRes({ error: "no_deed_templates" }, 500);
  }

  const deedRow = weightedPick(templates);
  const shuffled = shuffle(players);
  const victim = shuffled[Math.floor(Math.random() * shuffled.length)]!;

  const NEEDS_IG_TARGET = new Set(["dm_random", "follow_user", "unfollow_user"]);
  const baseParams =
    typeof deedRow.params === "object" && deedRow.params !== null
      ? { ...(deedRow.params as Record<string, unknown>) }
      : {};

  let params: Record<string, unknown> = baseParams;
  if (NEEDS_IG_TARGET.has(deedRow.deed_type)) {
    const others = players.filter(
      (p) => p.id !== victim.id && p.ig_username && String(p.ig_username).trim(),
    );
    if (others.length === 0) {
      return jsonRes(
        {
          error: "no_other_player_with_ig",
          detail:
            "This deed needs another player in the room with an Instagram username (join/create after IG login).",
        },
        400,
      );
    }
    const target = others[Math.floor(Math.random() * others.length)]!;
    params = {
      ...baseParams,
      target_username: target.ig_username,
      target_display_name: target.display_name ?? target.ig_username,
    };
    if (deedRow.deed_type === "dm_random") {
      const dt = params.dm_text;
      if (typeof dt !== "string" || !dt.trim()) {
        params.dm_text = "👋 from shame.ai group room";
      }
    }
  }

  const deed = {
    template_id: deedRow.id,
    type: deedRow.deed_type,
    params,
  };

  const { data: lastRound } = await supabase
    .from("rounds")
    .select("round_index")
    .eq("room_id", body.room_id)
    .order("round_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const round_index = (lastRound?.round_index ?? 0) + 1;

  const { data: round, error: insErr } = await supabase
    .from("rounds")
    .insert({
      room_id: body.room_id,
      round_index,
      victim_player_id: victim.id,
      deed,
      status: "assigned",
    })
    .select("id, round_index, victim_player_id, deed, status, created_at")
    .single();

  if (insErr || !round) {
    console.error(insErr);
    return jsonRes(
      { error: "round_create_failed", detail: insErr?.message },
      500,
    );
  }

  await supabase
    .from("rooms")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", body.room_id);

  return jsonRes({
    round: {
      id: round.id,
      round_index: round.round_index,
      victim_player_id: round.victim_player_id,
      victim_ig_username: victim.ig_username || null,
      victim_display_name: victim.display_name || null,
      deed: round.deed,
      status: round.status,
      created_at: round.created_at,
    },
  });
});
