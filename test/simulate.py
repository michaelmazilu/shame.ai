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

from openai import AzureOpenAI

# Ensure test/ directory is on the path so config.py can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ACCOUNTS, GRAPHQL_TOKENS, headers as config_headers
from cache import get_mutuals_cached

# ── Azure OpenAI ──

azure_client = AzureOpenAI(
    api_version="2024-12-01-preview",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
)


def generate_confession(username, full_name=None, bio=None):
    """Generate a love confession DM using Azure OpenAI."""
    name = full_name or username
    context = f"Their name is {name} (Instagram: @{username})."
    if bio:
        context += f" Their bio says: \"{bio}\""
    resp = azure_client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write short, flirty Instagram DMs. Keep it under 2 sentences. "
                    "Be casual, confident, a little cheesy but not cringe. "
                    "Don't use emojis excessively. No hashtags. "
                    "This is a love confession / shooting your shot message. "
                    "If you know something about them from their bio, reference it naturally."
                ),
            },
            {
                "role": "user",
                "content": f"Write a love confession DM. {context}",
            },
        ],
        max_tokens=100,
        temperature=0.9,
    )
    return resp.choices[0].message.content.strip()

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


PROFILES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "profiles.json")


def load_profile_cache():
    if os.path.exists(PROFILES_PATH):
        with open(PROFILES_PATH, "r") as f:
            return json.load(f)
    return {}


def save_profile_cache(cache):
    with open(PROFILES_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def get_profile_info(username):
    url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}"
    status, data = rate_limited_request(url)
    if status != 200:
        return None
    user = (data.get("data") or {}).get("user")
    if not user:
        return None
    mutual_edges = (user.get("edge_mutual_followed_by") or {}).get("edges", [])
    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "fullName": user.get("full_name", ""),
        "bio": user.get("biography", ""),
        "profilePic": user.get("profile_pic_url_hd") or user.get("profile_pic_url", ""),
        "followers": (user.get("edge_followed_by") or {}).get("count", 0),
        "following": (user.get("edge_follow") or {}).get("count", 0),
        "postCount": (user.get("edge_owner_to_timeline_media") or {}).get("count", 0),
        "isPrivate": user.get("is_private", False),
        "isVerified": user.get("is_verified", False),
        "pronouns": user.get("pronouns", []),
        "externalUrl": user.get("external_url"),
        "mutualFollowers": (user.get("edge_mutual_followed_by") or {}).get("count", 0),
        "mutualFollowerNames": [e.get("node", {}).get("username") for e in mutual_edges],
    }


def enrich_and_cache(target, cache):
    """Fetch full profile, display it, save to cache."""
    uid = target["id"]
    if uid in cache:
        info = cache[uid]
        print(f"  {DIM}(cached){RESET}")
    else:
        print(f"  {DIM}Fetching profile...{RESET}")
        info = get_profile_info(target["username"])
        if info:
            cache[uid] = info
            save_profile_cache(cache)

    if not info:
        print(f"  {BOLD}@{target['username']}{RESET}  {DIM}{target.get('fullName', '')}{RESET}")
        return info

    name = info.get("fullName") or info["username"]
    verified = " ✓" if info.get("isVerified") else ""
    print(f"  {BOLD}{name}{verified}{RESET}  @{info['username']}")
    if info.get("pronouns"):
        print(f"  {DIM}{'/'.join(info['pronouns'])}{RESET}")
    if info.get("bio"):
        print(f"  {DIM}{info['bio'][:150]}{RESET}")
    if info.get("externalUrl"):
        print(f"  {DIM}{info['externalUrl']}{RESET}")
    stats = f"  {info['followers']} followers | {info['following']} following | {info['postCount']} posts"
    print(stats)
    if info.get("mutualFollowers", 0) > 0:
        names = info.get("mutualFollowerNames", [])
        mutual_str = f"{info['mutualFollowers']} mutual"
        if names:
            mutual_str += f" incl. @{', @'.join(names[:3])}"
        print(f"  {CYAN}{mutual_str}{RESET}")
    if info.get("profilePic"):
        print(f"  {DIM}pic: {info['profilePic'][:80]}...{RESET}")

    return info


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


def resolve_media_id(reel_url_or_shortcode):
    """Resolve a reel/post URL or shortcode to a media_id."""
    shortcode = reel_url_or_shortcode.strip().rstrip("/")
    for prefix in ("/reel/", "/reels/", "/p/"):
        if prefix in shortcode:
            shortcode = shortcode.split(prefix)[-1].split("/")[0].split("?")[0]
            break

    status, data = rate_limited_request(
        f"https://www.instagram.com/api/v1/media/{shortcode}/media_id/"
    )
    if status == 200 and isinstance(data, dict) and data.get("media_id"):
        return data["media_id"]

    status, data = rate_limited_request(
        f"https://www.instagram.com/api/v1/media/{shortcode}/info/"
    )
    if status == 200 and isinstance(data, dict):
        items = data.get("items", [])
        if items:
            return str(items[0].get("pk") or items[0].get("id"))

    return None


def send_reel_dm(recipient_id, reel_url, text=None):
    """Send a reel to a user via DM.

    Sends the reel URL as text — Instagram auto-embeds it as a rich
    reel preview in the DM thread. Uses the same GraphQL text send
    mutation as regular DMs.
    """
    if not reel_url.startswith("http"):
        reel_url = f"https://www.instagram.com/reel/{reel_url}/"
    message = f"{reel_url}\n{text}" if text else reel_url
    return send_dm_graphql(recipient_id, message)


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

    # Step 1: Get mutuals (cached — instant if already fetched within 1hr)
    mutuals = get_mutuals_cached(my_id, rate_limited_request)

    if not mutuals:
        print(f"{RED}Could not fetch lists. Check your cookies/session.{RESET}")
        return

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
    print(f"{DIM}Pick a number → see their profile → AI confession → sent.{RESET}")
    print(f"{DIM}[r] = reel, [c] = custom msg, q to quit.{RESET}\n")

    profile_cache = load_profile_cache()

    # DM loop
    while True:
        pick = input(f"  {GREEN}#{RESET} DM who? (1-{len(mutuals)} or q): ").strip().lower()
        if pick in ("q", "quit", ""):
            break
        try:
            idx = int(pick) - 1
            if idx < 0 or idx >= len(mutuals):
                print(f"  {RED}Pick 1-{len(mutuals)}{RESET}")
                continue
        except ValueError:
            print(f"  {RED}Enter a number or q{RESET}")
            continue

        target = mutuals[idx]
        info = enrich_and_cache(target, profile_cache)
        mode = input(f"  [Enter] = AI confession, [r] = reel, [c] = custom msg: ").strip().lower()

        if mode in ("r", "reel"):
            reel_url = input("  Reel URL or shortcode: ").strip()
            if not reel_url:
                continue
            msg = input("  Message (optional): ").strip() or None
            print(f"  Sending reel...")
            if send_reel_dm(target["id"], reel_url, msg):
                print(f"  {GREEN}Reel sent to @{target['username']}!{RESET}\n")
            else:
                print(f"  {RED}Failed to send reel{RESET}\n")
        elif mode in ("c", "custom"):
            msg = input("  Message: ").strip()
            if not msg:
                continue
            print(f"  Sending...")
            if send_dm_graphql(target["id"], msg):
                print(f"  {GREEN}Sent to @{target['username']}!{RESET}\n")
            else:
                print(f"  {RED}Failed{RESET}\n")
        else:
            # AI-generated love confession using profile context
            print(f"  {DIM}Generating confession...{RESET}")
            bio = (info or {}).get("bio", "")
            msg = generate_confession(target["username"], target.get("fullName"), bio)
            print(f"  {CYAN}\"{msg}\"{RESET}")
            print(f"  Sending...")
            if send_dm_graphql(target["id"], msg):
                print(f"  {GREEN}Sent to @{target['username']}!{RESET}\n")
            else:
                print(f"  {RED}Failed{RESET}\n")


if __name__ == "__main__":
    main()
