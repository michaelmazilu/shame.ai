# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

shame.ai is a multiplayer social dare game. Players spin roulettes that pick a victim, a ritual (embarrassing Instagram action), and a target. Rituals include DM love confessions, posting to stories, commenting on reels, and interacting with exes.

The project is a **hybrid system with four components:**

1. **Next.js web app** (`webapp/`) — Game UI, Instagram API proxy, AI generation
2. **Supabase backend** (`supabase/`) — Multiplayer rooms via Edge Functions
3. **Chrome extension** (root-level files) — "ShotTaker" Manifest V3 extension for Instagram overlay UI
4. **Playwright server** (`playwright-server/`) — Standalone Express + Playwright service for headless Instagram login on Vercel

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

### Chrome Extension (root-level)

The "ShotTaker" Manifest V3 extension (`manifest.json`, `background.js`, `content.js`, `swipe-ui.js`, `instagram-api.js`, `interceptor.js`, `popup.html/js`). Targets `*.instagram.com/*`. No build step — load unpacked from root in `chrome://extensions`.

### Playwright Server (`playwright-server/`)

Express + Playwright headless login service. Deployed separately on Vercel.

```bash
cd playwright-server
npm install
npx tsx server.ts    # http://localhost:3001
```

Requires `API_SECRET` env var for bearer token auth.

### Python Backend (`server/`)

FastAPI server with Instagram automation, AI generation, and analytics.

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload    # http://localhost:8000
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
- Custom CSS animations defined in `globals.css`: `.stagger-children` (fade-in with 80ms stagger), `.animate-roulette` (1.2s cubic-bezier wheel spin), `.animate-float`, `.animate-pulse-soft`.
- Webapp uses Tailwind v4 with `@theme` inline in `globals.css` — custom color/font/radius variables defined there, not in a separate tailwind config.
- The Chrome extension and webapp are independent codebases sharing no code — don't import between them.

## Architecture

### Web App (`webapp/`)

**Routes:** `/` (landing), `/login` (Instagram auth), `/app` (roulette game), `/room` (multiplayer lobby), `/history`, `/settings`

**API routes:** `/api/auth/{login,verify,checkpoint,browser}`, `/api/generate`, `/api/dm`, `/api/follow`, `/api/profiles`, `/api/profile/[username]`, `/api/relationship`, `/api/enrich`, `/api/comment`, `/api/story`, `/api/upload`, `/api/media-id`, `/api/feed-post`, `/api/pfp`, `/api/profile-edit`, `/api/reels/[id]`, `/api/img-proxy`, `/api/image-gen`, `/api/video-gen`, `/api/mp/{create-room,join-room,...}`

**Key libs:**

- `lib/instagram.ts` — Server-side IG API wrapper (42KB, GraphQL + REST)
- `lib/azure.ts` — Azure OpenAI message generation
- `lib/rituals.ts` — 10 ritual templates (love_declaration, fan_account, wrong_number, time_traveler, job_interview, conspiracy, breakup, life_advice, roommate, prophet)
- `lib/mp-deed-execute.ts` — Execute multiplayer deeds (dm_random, follow_user, unfollow_user, ritual DMs) via same-origin API routes
- `lib/multiplayer-api.ts` — Supabase Edge Function client
- `lib/multiplayer-session.ts` — localStorage session (room_id, tokens)
- `lib/browser-auth.ts` — Playwright-based Instagram login (local only; Vercel proxies to playwright-server)
- `lib/session.ts` — iron-session server cookies
- `lib/rate-limiter.ts` — Split rate limiting (500ms reads, 3s writes, 30s backoff on 429)
- `lib/ai-gen.ts` — AI text generation wrapper
- `lib/punishments.ts` — Ritual execution logic

**Key dependencies:** `@base-ui/react` (headless UI), `motion` (animations), `lucide-react` (icons), `shadcn` (components), `iron-session`, `clsx` + `tailwind-merge` + `class-variance-authority`

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

### Chrome Extension (root-level)

"ShotTaker" — Manifest V3, targets `*.instagram.com/*`. Separate from the webapp; manages its own state (shot history, seen profiles, DM rate limiting, pending follow-backs with 48-hour timeout). Uses `chrome.storage.local` for persistence and `chrome.alarms` for 5-minute polling.

### Python Backend (`server/`)

FastAPI app with routers for auth, DM, story, comment, media, profile, lottery. Uses Pydantic Settings from `.env` for config. Services layer includes AI generation (Azure OpenAI), FLUX image generation, and video generation.

### Key Data Flows

**Multiplayer game loop:** Host `create-room` → guests `join-room` via short_code → all players `heartbeat` → host `start-round` (picks random ready victim + weighted deed) → victim `submit-result` → all poll `room-state`.

**Instagram auth:** On Vercel, `/api/auth/browser` proxies to remote `playwright-server` via `PLAYWRIGHT_SERVER_URL` + `PLAYWRIGHT_API_SECRET`. Locally, it launches Playwright directly via `lib/browser-auth.ts`. Either way: session cookies stored server-side with iron-session → API routes proxy Instagram calls with the stored session.

**Deed execution (multiplayer):** `start-round` picks a deed → victim's client calls `lib/mp-deed-execute.ts` → which calls same-origin API routes (`/api/dm`, `/api/follow`, etc.) → which proxy to Instagram.
