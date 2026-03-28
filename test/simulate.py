#!/usr/bin/env python3
"""
ShotTaker — Find DM-able Mutuals
Fetches everyone you follow, checks who follows you back, and lists
the people you can DM directly.

Usage: python3 test/simulate.py
"""

import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request
import ssl

# Ensure test/ directory is on the path so config.py can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ACCOUNTS, GRAPHQL_TOKENS, headers as config_headers

ACTIVE = ACCOUNTS[0]

DELAY_READ = 0.5  # profile lookups, followers, explore
DELAY_WRITE = 3.0  # DMs, follows, unfollows

# ── HTTP helpers ──

ssl_ctx = ssl.create_default_context()

last_call_time = 0


def rate_limited_request(url, method="GET", data=None, extra_headers=None):
    """Make a rate-limited request to Instagram API."""
    global last_call_time

    is_write = method == "POST"
    min_delay = DELAY_WRITE if is_write else DELAY_READ

    elapsed = time.time() - last_call_time
    if elapsed < min_delay:
        wait = min_delay - elapsed
        print(f"  (rate limit: waiting {wait:.1f}s)")
        time.sleep(wait)
    last_call_time = time.time()

    headers = config_headers()
    if extra_headers:
        headers.update(extra_headers)

    if data and isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode()
        headers["content-type"] = "application/x-www-form-urlencoded"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        body = json.loads(resp.read().decode())
        return resp.status, body
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()[:500]
        try:
            body = json.loads(body_text)
        except Exception:
            body = body_text
        return e.code, body


# ── Instagram API functions ──


def get_following(user_id, count=200, max_id=None):
    url = f"https://www.instagram.com/api/v1/friendships/{user_id}/following/?count={count}&search_surface=follow_list_page"
    if max_id:
        url += f"&max_id={urllib.parse.quote(max_id)}"
    status, data = rate_limited_request(url)
    if status != 200:
        print(f"  [ERR] get_following: {status}")
        return [], None
    users = [
        {
            "id": str(u.get("pk") or u.get("pk_id")),
            "username": u.get("username"),
            "fullName": u.get("full_name", ""),
            "isPrivate": u.get("is_private", False),
        }
        for u in data.get("users", [])
    ]
    return users, data.get("next_max_id")


def get_all_following(user_id):
    all_users = []
    max_id = None
    page = 0
    while True:
        page += 1
        users, max_id = get_following(user_id, 200, max_id)
        all_users.extend(users)
        print(f"    page {page}: got {len(users)}, total so far {len(all_users)}")
        if not max_id or len(users) == 0:
            break
    return all_users


def get_followers(user_id, count=200, max_id=None):
    url = f"https://www.instagram.com/api/v1/friendships/{user_id}/followers/?count={count}&search_surface=follow_list_page"
    if max_id:
        url += f"&max_id={urllib.parse.quote(max_id)}"
    status, data = rate_limited_request(url)
    if status != 200:
        print(f"  [ERR] get_followers: {status}")
        return [], None
    users = [
        {
            "id": str(u.get("pk") or u.get("pk_id")),
            "username": u.get("username"),
            "fullName": u.get("full_name", ""),
            "isPrivate": u.get("is_private", False),
        }
        for u in data.get("users", [])
    ]
    return users, data.get("next_max_id")


def get_all_followers(user_id):
    all_users = []
    max_id = None
    page = 0
    while True:
        page += 1
        users, max_id = get_followers(user_id, 200, max_id)
        all_users.extend(users)
        print(f"    page {page}: got {len(users)}, total so far {len(all_users)}")
        if not max_id or len(users) == 0:
            break
    return all_users


def send_dm_graphql(recipient_id, text):
    offline_id = str(random.randint(10**18, 9 * 10**18))
    variables = {
        "ig_thread_igid": None,
        "offline_threading_id": offline_id,
        "recipient_igids": [str(recipient_id)],
        "replied_to_client_context": None,
        "replied_to_item_id": None,
        "reply_to_message_id": None,
        "sampled": None,
        "text": {"sensitive_string_value": text},
        "mentions": [],
        "mentioned_user_ids": [],
        "commands": None,
    }
    form_data = {
        "fb_dtsg": GRAPHQL_TOKENS["fb_dtsg"],
        "lsd": GRAPHQL_TOKENS["lsd"],
        "__a": "1",
        "__user": "0",
        "__comet_req": "7",
        "fb_api_caller_class": "RelayModern",
        "fb_api_req_friendly_name": "IGDirectTextSendMutation",
        "server_timestamps": "true",
        "variables": json.dumps(variables),
        "doc_id": "25288447354146606",
    }
    status, data = rate_limited_request(
        "https://www.instagram.com/api/graphql",
        method="POST",
        data=form_data,
        extra_headers={
            "x-fb-friendly-name": "IGDirectTextSendMutation",
            "x-fb-lsd": GRAPHQL_TOKENS["lsd"],
        },
    )
    errors = data.get("errors", []) if isinstance(data, dict) else []
    return status == 200 and len(errors) == 0


# ── Display ──

BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"


def format_count(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


# ── Main ──


def main():
    my_id = ACTIVE["userId"]

    print(f"\n{BOLD}ShotTaker — Find DM-able Mutuals{RESET}")

    # Step 1: Fetch following and followers lists
    print(f"{DIM}Fetching everyone you follow...{RESET}")
    following = get_all_following(my_id)
    print(f"  You follow {BOLD}{len(following)}{RESET} people\n")

    print(f"{DIM}Fetching your followers...{RESET}")
    followers = get_all_followers(my_id)
    print(f"  You have {BOLD}{len(followers)}{RESET} followers\n")

    if not following or not followers:
        print(f"{RED}Could not fetch lists. Check your cookies/session.{RESET}")
        return

    # Step 2: Intersect to find mutuals
    follower_ids = {p["id"] for p in followers}
    following_by_id = {p["id"]: p for p in following}
    mutual_ids = follower_ids & set(following_by_id.keys())
    mutuals = [following_by_id[mid] for mid in mutual_ids]
    mutuals.sort(key=lambda p: p["username"].lower())

    # Step 3: Print results
    print(f"{'=' * 50}")
    print(f"  {BOLD}{len(mutuals)}{RESET} mutuals found")
    print(f"  {GREEN}All {len(mutuals)} can receive DMs{RESET}")
    print(f"{'=' * 50}\n")

    if not mutuals:
        print(f"{YELLOW}No mutual follows found.{RESET}")
        return

    for i, p in enumerate(mutuals):
        name = p.get("fullName") or ""
        name_part = f"  {DIM}{name}{RESET}" if name else ""
        print(f"  {GREEN}{i + 1:>3}.{RESET} @{p['username']}{name_part}")

    print(f"\n{DIM}{len(mutuals)} people you can DM right now.{RESET}")
    print(f"{DIM}Enter a number to DM someone, or q to quit.{RESET}\n")

    # DM loop
    while True:
        pick = input(f"  {GREEN}#{RESET} DM who? (1-{len(mutuals)} or q): ").strip().lower()
        if pick in ("q", "quit", ""):
            break
        try:
            idx = int(pick) - 1
            if idx < 0 or idx >= len(mutuals):
                print(f"  {RED}Pick a number between 1 and {len(mutuals)}{RESET}")
                continue
        except ValueError:
            print(f"  {RED}Enter a number or q{RESET}")
            continue

        target = mutuals[idx]
        name = target.get("fullName") or target["username"]
        print(f"\n  {BOLD}@{target['username']}{RESET}  {DIM}{name}{RESET}")
        msg = input("  Message: ").strip()
        if not msg:
            print(f"  {DIM}Skipped (empty message){RESET}\n")
            continue

        confirm = input(f"  Send to @{target['username']}? [Y/n]: ").strip().lower()
        if confirm == "n":
            print(f"  {DIM}Cancelled{RESET}\n")
            continue

        print(f"  Sending...")
        if send_dm_graphql(target["id"], msg):
            print(f"  {GREEN}Sent to @{target['username']}!{RESET}\n")
        else:
            print(f"  {RED}Failed to send DM{RESET}\n")


if __name__ == "__main__":
    main()
