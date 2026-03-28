# shame.ai helper scripts

## `shame-mp`

Calls your Supabase Edge Functions using **`.env.local`** (publishable key only).

Set **`SUPABASE_URL`** and your publishable key in repo root **`.env.local`** (see root `.env.example`).

Optional: **`MP_IG_USERNAME`** or **`IG_USERNAME`** — sent as `ig_username` on `create` / `join` (same field the web lobby sends after Instagram login).

Smoke test (needs network + deployed functions): `python3 test/test_mp_edge.py` (join uses a second synthetic `ig_username` so `start-round` can pick a target).

### One-time

1. Repo root has **`.env.local`** with `SUPABASE_PUBLISHABLE_KEY=...` (and optional `SUPABASE_URL`).
2. From repo root:

```bash
chmod +x scripts/shame-mp   # once
```

### Same laptop: host + guest

**Terminal A (host)**

```bash
cd /Users/rupertkahng/Projects/shame.ai
./scripts/shame-mp create Rupert
./scripts/shame-mp hb-host
./scripts/shame-mp start
./scripts/shame-mp submit ok "test"
./scripts/shame-mp state host
```

**Terminal B (guest)** — after host ran `create`, share **short_code**:

```bash
cd /Users/rupertkahng/Projects/shame.ai
./scripts/shame-mp join W232LZ Player2
./scripts/shame-mp hb-guest
```

Then host runs **`start`** again (both should **`hb-*`** within ~90s before **`start`**).

Session file **`.shame-ai-session.json`** is written in the repo root (gitignored). Each terminal that needs its own **join-only** session should use a **copy of the repo** or run **join** in a folder with no prior session—or host and guest alternate: on **one** machine, run **`create`**, then **`join`** in the **same** folder so one session keeps **host + guest** tokens (script merges).

### Commands

| Command | Meaning |
|--------|---------|
| `./scripts/shame-mp url` | Print base URL |
| `./scripts/shame-mp create [name]` | New room (host) |
| `./scripts/shame-mp join CODE [name]` | Join by short code |
| `./scripts/shame-mp hb-host` | Host heartbeat |
| `./scripts/shame-mp hb-guest` | Guest heartbeat |
| `./scripts/shame-mp start` | Host starts round |
| `./scripts/shame-mp submit ok \| skipped \| error [detail]` | Victim submits |
| `./scripts/shame-mp state [guest]` | `state guest` = guest view |
| `./scripts/shame-mp close` | Host closes room |

Full API: [../supabase/API.md](../supabase/API.md).
