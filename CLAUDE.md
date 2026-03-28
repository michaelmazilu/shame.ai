# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

shame.ai is a multiplayer social dare game. Players spin roulettes that pick a victim, a ritual (embarrassing Instagram action), and a target. Rituals include DM love confessions, posting to stories, commenting on reels, and interacting with exes. The project has two components: a Next.js web app for the game UI and a Supabase backend for multiplayer rooms.

## Development

### Web App (`webapp/`)

Next.js 16.2.1 with React 19, Tailwind CSS 4, TypeScript. **Note:** This Next.js version has breaking changes from training data — read `node_modules/next/dist/docs/` before writing code.

```bash
cd webapp
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
```

Node.js must be in PATH. If not, prefix with: `export PATH="/c/Program Files/nodejs:$PATH"`

### Supabase Multiplayer (`supabase/`)

Edge Functions in Deno TypeScript. Requires Docker for local dev.

```bash
supabase start                          # local stack (API :54321, Studio :54323)
supabase functions deploy               # deploy all Edge Functions
supabase db push                        # push migrations
supabase link --project-ref <REF>       # link to remote project
```

### Instagram API Testing (`test/`)

Python scripts for testing Instagram API calls. Requires `python-dotenv` + `instagrapi`.

```bash
cp .env.example .env                    # fill in IG session cookies
pip install -r requirements.txt
python3 test/simulate.py                # interactive pipeline
python3 test/test_api.py                # individual API tests
python3 test/ig_story.py photo.jpg      # story upload (needs IG_USERNAME/IG_PASSWORD)
```

### Multiplayer CLI Testing (`scripts/`)

```bash
scripts/shame-mp create                 # create room
scripts/shame-mp join W232LZ            # join by code
scripts/shame-mp start                  # host starts round
scripts/shame-mp state                  # view room state
```

## Rules

- Supabase shared code goes in `supabase/_shared/`, NOT under `supabase/functions/` (breaks deployment).
- All Supabase tables have RLS enabled with no public policies — only Edge Functions (service_role) access the DB.
- The webapp uses `motion` (framer-motion) for animations with spring physics. Use `type: "spring"` transitions, not linear easing.
- Colour palette: rose (`#E36B8A`), pink (`#F08DA0`), blush (`#F2C4CB`), gold (`#C4A265`), beige (`#D4BC96`), cream (`#EDE8C8`). Defined in `webapp/app/globals.css`.
- Font stack: Geist (sans), Playfair Display (cursive accents via `font-cursive` class). Inter is banned.

## Architecture

### Web App (`webapp/`)

**Routes:** `/` (landing), `/login` (Instagram auth), `/app` (roulette game), `/room` (multiplayer lobby), `/history`, `/settings`

**API routes:** `/api/auth/{login,verify,checkpoint,browser}`, `/api/generate`, `/api/dm`, `/api/follow`, `/api/profiles`, `/api/relationship`, `/api/enrich`

**Key libs:**
- `lib/instagram.ts` — Server-side IG API wrapper
- `lib/azure.ts` — Azure OpenAI message generation
- `lib/rituals.ts` — 10 ritual templates with prompts
- `lib/multiplayer-api.ts` — Supabase Edge Function client
- `lib/multiplayer-session.ts` — localStorage session (room_id, tokens)
- `lib/browser-auth.ts` — Playwright-based Instagram login
- `lib/session.ts` — iron-session server cookies
- `lib/rate-limiter.ts` — Split rate limiting (500ms reads, 3s writes, 30s backoff on 429)

### Supabase Backend (`supabase/`)

**Tables:** `deed_templates` (weighted ritual pool), `rooms`, `room_players`, `rounds`

**Edge Functions (all POST, JSON):**
- `create-room` — Host creates game, gets host_secret + player_token + short_code
- `join-room` — Join via short_code or invite_token
- `heartbeat` — Player keepalive (90s ready window)
- `start-round` — Host triggers random deed + victim selection
- `submit-result` — Victim submits ok/skipped/error
- `room-state` — Full room sync (last 50 rounds)
- `close-room` — Host ends game

Auth: token hashes in DB, raw tokens held client-side only. See `supabase/API.md` for full endpoint docs.

### Key Data Flows

**Multiplayer game loop:** Host `create-room` → guests `join-room` via short_code → all players `heartbeat` → host `start-round` (picks random ready victim + weighted deed) → victim `submit-result` → all poll `room-state`.

**Instagram auth:** User logs in via Playwright browser automation (`/api/auth/browser`) → session stored server-side with iron-session → API routes proxy Instagram calls with the stored session cookies.
