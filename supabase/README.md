# shame.ai — Supabase (multiplayer server)

This folder is **only** the Supabase project: config, SQL migrations, and **Edge Functions** for the multiplayer API. It does not touch the Chrome extension code in the repo root.

**Full endpoint reference:** [API.md](./API.md)

**Web UI:** Next.js lobby at [../webapp/app/room/page.tsx](../webapp/app/room/page.tsx) (`/room`) — set `NEXT_PUBLIC_SUPABASE_*` in `webapp/.env.local`.

**Shared Deno code** lives in [`_shared/`](./_shared/) (next to `functions/`), **not** inside `functions/`. If a folder sits under `functions/` with a name that doesn’t match `^[A-Za-z][A-Za-z0-9_-]*$` (e.g. `_shared`), `supabase functions deploy` fails with “Invalid Function name”.

## Prerequisites

- A [Supabase](https://supabase.com) account and a **new empty project** (or an existing one you own).
- **Docker Desktop** (only if you want a fully local Postgres/API stack).

## Option A — Connect this repo to your **hosted** project (typical)

1. **Create a project** in the [Supabase Dashboard](https://supabase.com/dashboard) (note the region).

2. **Install the CLI** (pick one):

   ```bash
   # macOS (Homebrew)
   brew install supabase/tap/supabase

   # Or use npx (no global install)
   npx supabase@latest --help
   ```

3. **Log in** (opens the browser):

   ```bash
   cd /path/to/shame.ai
   supabase login
   ```

4. **Link** this repo to the cloud project. In the dashboard: **Project Settings → General → Reference ID**.

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

   The CLI may ask for the **database password** (Settings → Database → Database password).

5. **Apply migrations** (after SQL files exist under `supabase/migrations/`):

   ```bash
   supabase db push
   ```

6. **Keys for clients** (extension, scripts, etc. — later): **Project Settings → API**

   - `Project URL` → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY` (browser/extension safe **only** with strict RLS)
   - `service_role` → **never** ship in an extension; Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` from the dashboard secrets

## Option B — **Local** Supabase (offline development)

Requires Docker running.

```bash
cd /path/to/shame.ai
supabase start
```

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- Stop: `supabase stop`

Use `supabase status` to print local URLs and the **anon** / **service_role** keys.

## Useful commands

| Command | Purpose |
|--------|---------|
| `supabase db diff -f name` | Generate a migration from schema changes (after linking or local edits) |
| `supabase db reset` | Local only: reset DB and re-run migrations + `seed.sql` |
| `supabase functions new my-fn` | Scaffold an Edge Function |
| `supabase functions deploy my-fn` | Deploy one function to the linked project |

## Edge Functions (multiplayer HTTP API)

Deployed functions use **`verify_jwt = false`**; callers authenticate with **room/player tokens** in JSON bodies, not Supabase Auth. You still must send a gateway header so Supabase accepts the request:

- **`Authorization: Bearer <publishable_or_anon_key>`** (same key as in `.env.local`)

Base URL:

`https://<PROJECT_REF>.supabase.co/functions/v1/<function-name>`

| Function | Method | Purpose |
|----------|--------|---------|
| `create-room` | POST | Create room + host player; returns `host_secret`, `player_token`, `invite_token`, `short_code` |
| `join-room` | POST | Body: `invite_token` *or* `short_code` + optional profile fields; returns `player_token` |
| `heartbeat` | POST | Body: `room_id`, `player_token` — marks player ready (within last 90s for rounds) |
| `start-round` | POST | Body: `room_id`, `host_secret` — picks weighted random deed + random ready victim |
| `room-state` | POST | Body: `room_id`, `player_token` — room, players, **latest_round**, **rounds** (last 50) |
| `submit-result` | POST | Body: `room_id`, `player_token`, `round_id`, `result_status` (`ok` \| `skipped` \| `error`) |
| `close-room` | POST | Body: `room_id`, `host_secret` — host closes the room |

### Deploy (from repo root, linked project)

```bash
cd /path/to/shame.ai
npx supabase@latest functions deploy
```

Hosted Edge runtimes receive **`SUPABASE_SERVICE_ROLE_KEY`** automatically (do not paste it in client apps).

### Quick test (`create-room`)

```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export KEY="your_publishable_or_anon_key"

curl -sS -X POST "$SUPABASE_URL/functions/v1/create-room" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Host"}' | jq .
```

Copy `room_id`, `host_secret`, and `player_token` from the response, then call `heartbeat`, then `start-round` with the host secret (single-player test: victim may be the host).

## Secrets (Edge Functions)

Custom app secrets (if you add any) go in the dashboard (**Project Settings → Edge Functions → Secrets**) or:

```bash
supabase secrets set MY_SECRET=value
```

`SUPABASE_URL` / service role for functions are **injected by Supabase** when deployed. Do not commit real keys. Local overrides can live in `supabase/.env` (see `supabase/.gitignore`).
