#!/usr/bin/env python3
"""
Optional: exercise multiplayer Edge Functions (create → join → heartbeat ×2 → start-round).

Requires repo root .env.local: SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (or KEY).
Sends ig_username on create/join (matches web lobby). start-round needs ≥2 players
with distinct room_players rows and ig_username set (CLI: set MP_IG_USERNAME).

  python3 test/test_mp_edge.py
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env.local"


def load_env() -> None:
    if not ENV.is_file():
        return
    for line in ENV.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" in line:
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k:
                os.environ[k] = v


def post(url: str, key: str, fn: str, body: dict) -> dict:
    u = f"{url.rstrip('/')}/functions/v1/{fn}"
    req = urllib.request.Request(
        u,
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"error": "http", "status": e.code, "body": raw}


def main() -> None:
    load_env()
    base = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    key = (
        os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
        or os.environ.get("SUPABASE_ANON_KEY", "")
        or os.environ.get("KEY", "")
    ).strip()
    ig = (os.environ.get("MP_IG_USERNAME") or os.environ.get("IG_USERNAME") or "test_cli_user").strip()

    if not base or not key:
        print("Need SUPABASE_URL and key in .env.local", file=sys.stderr)
        sys.exit(1)

    a = post(base, key, "create-room", {"display_name": "HostA", "ig_username": ig})
    if a.get("error"):
        print(json.dumps(a, indent=2))
        sys.exit(1)
    code = a["short_code"]
    room_id = a["room_id"]
    host_secret = a["host_secret"]
    host_tok = a["player_token"]

    b = post(
        base,
        key,
        "join-room",
        {"short_code": code, "display_name": "GuestB", "ig_username": ig + "_b"},
    )
    if b.get("error"):
        print(json.dumps(b, indent=2))
        sys.exit(1)
    guest_tok = b["player_token"]

    post(base, key, "heartbeat", {"room_id": room_id, "player_token": host_tok})
    post(base, key, "heartbeat", {"room_id": room_id, "player_token": guest_tok})

    st = post(
        base,
        key,
        "start-round",
        {"room_id": room_id, "host_secret": host_secret},
    )
    print(json.dumps(st, indent=2))
    if st.get("error"):
        sys.exit(1)
    deed = (st.get("round") or {}).get("deed") or {}
    assert deed.get("params", {}).get("target_username"), "expected enriched target_username"


if __name__ == "__main__":
    main()
