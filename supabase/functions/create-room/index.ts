import { corsHeaders, jsonRes } from "../../_shared/cors.ts";
import { randomHex, randomShortCode, sha256Hex } from "../../_shared/crypto.ts";
import { serviceClient } from "../../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonRes({ error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown> = {};
  try {
    const t = await req.text();
    if (t) body = JSON.parse(t);
  } catch {
    return jsonRes({ error: "invalid_json" }, 400);
  }

  const supabase = serviceClient();

  const invite_token = randomHex(32);
  const host_secret = randomHex(32);
  const host_secret_hash = await sha256Hex(host_secret);
  const player_token = randomHex(32);
  const player_token_hash = await sha256Hex(player_token);

  for (let attempt = 0; attempt < 15; attempt++) {
    const short_code = randomShortCode();
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .insert({
        short_code,
        invite_token,
        host_secret_hash,
        status: "open",
        last_activity_at: new Date().toISOString(),
      })
      .select("id, short_code, created_at")
      .single();

    if (roomErr) {
      if (String(roomErr.message).includes("duplicate") || roomErr.code === "23505") {
        continue;
      }
      console.error(roomErr);
      return jsonRes({ error: "room_create_failed", detail: roomErr.message }, 500);
    }

    const { data: player, error: pErr } = await supabase
      .from("room_players")
      .insert({
        room_id: room.id,
        player_token_hash,
        role: "host",
        display_name: (body.display_name as string) ?? null,
        ig_username: (body.ig_username as string) ?? null,
        profile_pic_url: (body.profile_pic_url as string) ?? null,
        last_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (pErr) {
      await supabase.from("rooms").delete().eq("id", room.id);
      console.error(pErr);
      return jsonRes({ error: "player_create_failed", detail: pErr.message }, 500);
    }

    return jsonRes({
      room_id: room.id,
      short_code: room.short_code,
      invite_token,
      /** Show to host once; required for start_round */
      host_secret,
      /** Host uses this as player identity + heartbeat + submit_result */
      player_token,
      host_player_id: player.id,
      warning:
        "Store host_secret and player_token securely; they cannot be recovered.",
    });
  }

  return jsonRes({ error: "short_code_collision_retry_failed" }, 500);
});
