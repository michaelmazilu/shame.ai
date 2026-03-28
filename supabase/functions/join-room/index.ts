import { corsHeaders, jsonRes } from "../../_shared/cors.ts";
import { randomHex, sha256Hex } from "../../_shared/crypto.ts";
import { serviceClient } from "../../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "method_not_allowed" }, 405);
  }

  let body: {
    short_code?: string;
    invite_token?: string;
    display_name?: string;
    ig_username?: string;
    profile_pic_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "invalid_json" }, 400);
  }

  const short = body.short_code?.trim().toUpperCase();
  const inv = body.invite_token?.trim();
  if (!short && !inv) {
    return jsonRes({ error: "need_short_code_or_invite_token" }, 400);
  }

  const supabase = serviceClient();

  let q = supabase.from("rooms").select("id, short_code, status").eq(
    "status",
    "open",
  );
  if (inv) q = q.eq("invite_token", inv);
  else q = q.eq("short_code", short!);

  const { data: room, error: rErr } = await q.single();
  if (rErr || !room) {
    return jsonRes({ error: "room_not_found_or_closed" }, 404);
  }

  const player_token = randomHex(32);
  const player_token_hash = await sha256Hex(player_token);

  const { data: player, error: pErr } = await supabase
    .from("room_players")
    .insert({
      room_id: room.id,
      player_token_hash,
      role: "member",
      display_name: body.display_name ?? null,
      ig_username: body.ig_username ?? null,
      profile_pic_url: body.profile_pic_url ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (pErr) {
    console.error(pErr);
    return jsonRes({ error: "join_failed", detail: pErr.message }, 500);
  }

  await supabase
    .from("rooms")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", room.id);

  return jsonRes({
    room_id: room.id,
    short_code: room.short_code,
    player_token,
    player_id: player.id,
    warning: "Store player_token; required for heartbeat and submit_result.",
  });
});
