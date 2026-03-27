# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShotTaker is a Chrome Extension (Manifest V3) that overlays a Tinder-style swipe UI on Instagram. Users swipe right to "shoot their shot" (send a DM) or left to pass. It fetches profiles from Instagram's internal API using the browser's existing session cookies.

## Development

No build step — plain JavaScript, CSS, and HTML. Load as an unpacked Chrome extension:

1. Go to `chrome://extensions/` → enable Developer Mode
2. Click "Load unpacked" → select the repo root (or `extension/` for the alternate version)
3. Navigate to instagram.com to see the overlay

No tests, linter, or package manager for the extension itself.

## Backend Testing (test/)

Python scripts for testing Instagram API calls outside the browser. Requires `python-dotenv`.

```bash
# Setup
cp .env.example .env   # then fill in your IG session cookies from DevTools
pip install python-dotenv

# Run the interactive pipeline simulation
python3 test/simulate.py

# Run individual API tests
python3 test/test_api.py
python3 test/test_followers.py
```

Credentials live in `.env` (gitignored). `test/config.py` reads them via `dotenv` and exports `ACCOUNTS`, `GRAPHQL_TOKENS`, `SHARED_HEADERS`. Other test files import from `config.py`.

## Architecture

**Content scripts** (injected into instagram.com pages in this order per manifest):

1. `instagram-api.js` — IIFE exposing `InstagramAPI` global. Wraps IG internal REST endpoints (`/api/v1/...`) with rate-limited fetch (2.5s minimum between calls, 30s backoff on 429). Handles: suggested users, explore profiles, profile info enrichment, following lists, and DM sending.
2. `swipe-ui.js` — IIFE exposing `SwipeUI` global. Renders the draggable card stack with mouse/touch gesture handling. Swipe threshold is 100px.
3. `content.js` — Main orchestrator. Injects `interceptor.js` into page context, loads persisted state from `chrome.storage.local`, wires swipe callbacks to API calls, and manages the profile loading pipeline (fetch → filter seen/private → deduplicate → enrich top 20).

**Other files:**

- `interceptor.js` — Injected into IG's page context (not content script world). Monkey-patches `window.fetch` to passively capture API responses via `postMessage` with type `ST_DATA`.
- `background.js` — Service worker. Manages shot history (capped at 500), handles `ST_SHOT_SENT`, `ST_GET_HISTORY`, `ST_RESET` messages.
- `popup.html` / `popup.js` — Extension popup for settings (DM template, rate limit, profile sources) and shot history display.
- `styles.css` — All swipe UI styling.

### Key data flows

**GraphQL token acquisition** — Required for DM sending via the modern GraphQL endpoint:

1. `interceptor.js` (page context) watches outgoing IG GraphQL requests for `fb_dtsg` + `lsd` params
2. Sends them via `postMessage` with type `ST_TOKENS` to content script world
3. `content.js` passes tokens to `InstagramAPI.setGraphQLTokens()`
4. `sendDMGraphQL()` uses these tokens; if unavailable, falls back to the legacy REST `sendDM()` endpoint

**Content script load order matters** — `instagram-api.js` and `swipe-ui.js` expose `InstagramAPI` and `SwipeUI` as globals that `content.js` depends on. The manifest `js` array order controls this.

### Message protocol

All inter-component communication uses `chrome.runtime.sendMessage` or `window.postMessage`:

- `ST_TOKENS` — interceptor → content script (GraphQL auth tokens)
- `ST_DATA` — interceptor → content script (passive API data)
- `ST_SETTINGS_UPDATE` / `ST_TOGGLE` — popup → content script
- `ST_GET_STATUS` — popup → content script
- `ST_SHOT_SENT` / `ST_GET_HISTORY` / `ST_RESET` — content script ↔ background

### Storage keys (chrome.storage.local)

All prefixed with `st_`: `st_settings`, `st_seen`, `st_shot_history`, `st_dms_hour`, `st_dms_reset`.

### Rate limiting

`InstagramAPI` enforces a minimum 2.5s between API calls with automatic 30s backoff on HTTP 429. DM sends are additionally capped per hour (default 10, configurable in popup) with the counter persisted in `chrome.storage.local` and reset after 1 hour.
