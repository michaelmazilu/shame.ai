# shame.ai multiplayer HTTP API

Base URL:

`https://<PROJECT_REF>.supabase.co/functions/v1`

All routes use **POST** and **JSON** unless noted. Every request needs:

```http
Authorization: Bearer <publishable_or_anon_key>
apikey: <same_key>
Content-Type: application/json
```

Game auth uses **`host_secret`** (host only, from `create-room`) and **`player_token`** (per player). Store them like passwords; they are not recoverable from the API.

---

## `POST /create-room`

Create a room and the **host** player.

**Body (optional):** `{ "display_name", "ig_username", "profile_pic_url" }`

**200:** `{ room_id, short_code, invite_token, host_secret, player_token, host_player_id, warning }`

Secrets **`host_secret`** and **`player_token`** are shown **once**.

---

## `POST /join-room`

**Body:** `{ "short_code": "W232LZ" }` **or** `{ "invite_token": "<hex>" }`  
Optional profile fields same as create-room.

**200:** `{ room_id, short_code, player_token, player_id, warning }`  
**404:** `room_not_found_or_closed`

---

## `POST /heartbeat`

Marks the player as **ready** (seen within the last **180s** for `start-round`).

**Body:** `{ "room_id", "player_token" }`

**200:** `{ ok: true, player_id }`  
**404:** `player_not_in_room`

---

## `POST /start-round`

**Host only.** Body: `{ "room_id", "host_secret" }`

Picks a **ready** player at random (victim) and a **weighted** deed from `deed_templates`.

For **`dm_random`**, **`follow_user`**, **`unfollow_user`**, the server **merges** into `deed.params`:

- `target_username`, `target_display_name` — a random **other** ready player who has `ig_username` set (web lobby sends this on create/join).
- `dm_text` — for `dm_random`, defaults to a short line if the template omits it.

If no other ready player has `ig_username`, returns **400** `no_other_player_with_ig`.

**200:** `{ round: { id, round_index, victim_player_id, deed, status, created_at } }`  
**403:** `forbidden_invalid_host_secret`  
**400:** `no_eligible_players_ready`, `room_closed`, `no_other_player_with_ig`

---

## `POST /submit-result`

**Victim only** for that round.

**Body:**

```json
{
  "room_id": "uuid",
  "player_token": "hex",
  "round_id": "uuid",
  "result_status": "ok | skipped | error",
  "result_detail": "optional",
  "error_code": "optional"
}
```

**200:** `{ ok: true, round_id, status }` where `status` is `completed` / `skipped` / `failed`  
**403:** `only_victim_can_submit`  
**400:** `round_already_finalized`

---

## `POST /room-state`

Any player in the room.

**Body:** `{ "room_id", "player_token" }`

**200:**

```json
{
  "room": { "id", "short_code", "status", "created_at" },
  "you": { "id", "role", "display_name", "ig_username", "last_seen_at" },
  "players": [ ... ],
  "latest_round": { ... } | null,
  "rounds": [ ... ]
}
```

`rounds` is up to the **50** most recent rounds (newest first).

---

## `POST /close-room`

**Host only.** Body: `{ "room_id", "host_secret" }`

**200:** `{ ok: true, room_id, status: "closed" }`  
**400:** `already_closed`

---

## Error shape

Errors return JSON like `{ "error": "code", "detail"?: "..." }` with 4xx/5xx status.

---

## Deploy

From repo root (linked project):

```bash
npx supabase@latest functions deploy
```

Edge runtime injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.
