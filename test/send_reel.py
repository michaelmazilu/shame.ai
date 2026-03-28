#!/usr/bin/env python3
"""
ShotTaker — Send Reels via DM
Fetches your mutuals, lets you pick someone, and sends them a reel
(from the Reels tab, explore page, a hashtag, a user, or a URL)
with an optional message.

Usage: python3 test/send_reel.py                 # interactive reel picker
       python3 test/send_reel.py <reelUrl>        # send a specific reel
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

from config import ACCOUNTS, headers as config_headers
from cache import get_mutuals_cached
from ig_auth import get_client

ACTIVE = ACCOUNTS[0]

DELAY_READ = 0.5
DELAY_WRITE = 3.0

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


def shortcode_to_media_id(shortcode):
    """Convert an Instagram shortcode to a numeric media ID.

    Shortcodes are base64-encoded (with a custom alphabet) representations
    of the numeric media PK.
    """
    ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    media_id = 0
    for char in shortcode:
        media_id = media_id * 64 + ALPHABET.index(char)
    return str(media_id)


def resolve_media_id(reel_url_or_shortcode):
    """Resolve a reel/post URL or shortcode to a media_id."""
    shortcode = reel_url_or_shortcode.strip().rstrip("/")
    for prefix in ("/reel/", "/reels/", "/p/"):
        if prefix in shortcode:
            shortcode = shortcode.split(prefix)[-1].split("/")[0].split("?")[0]
            break

    print(f"  Resolving shortcode: {shortcode}")

    # Decode the shortcode locally — no API call needed
    try:
        media_id = shortcode_to_media_id(shortcode)
        print(f"  media_id: {media_id}")
        return media_id
    except (ValueError, IndexError):
        pass

    # Fallback: try the info endpoint with the shortcode as a numeric ID
    status, data = rate_limited_request(
        f"https://www.instagram.com/api/v1/media/{shortcode}/info/"
    )
    if status == 200 and isinstance(data, dict):
        items = data.get("items", [])
        if items:
            media_id = str(items[0].get("pk") or items[0].get("id"))
            print(f"  media_id: {media_id}")
            return media_id

    return None


def fetch_graphql_tokens():
    """Scrape fresh fb_dtsg and lsd tokens by loading an Instagram page.

    These tokens rotate every session and expire quickly, so we fetch
    them live rather than relying on stale .env values.
    """
    headers = config_headers()
    req = urllib.request.Request(
        "https://www.instagram.com/",
        headers=headers,
    )
    resp = urllib.request.urlopen(req, context=ssl_ctx)
    html = resp.read().decode("utf-8", errors="replace")

    import re
    dtsg_match = re.search(r'"DTSGInitialData".*?"token":"([^"]+)"', html)
    lsd_match = re.search(r'"LSD".*?"token":"([^"]+)"', html)

    if not dtsg_match or not lsd_match:
        # Fallback patterns
        dtsg_match = dtsg_match or re.search(r'fb_dtsg["\s:]+value["\s:]+([^"&]+)', html)
        lsd_match = lsd_match or re.search(r'"lsd":"([^"]+)"', html)

    if not dtsg_match or not lsd_match:
        print(f"  {RED}Could not scrape GraphQL tokens from page{RESET}")
        print(f"  {DIM}Update FB_DTSG and LSD in .env manually{RESET}")
        from config import GRAPHQL_TOKENS
        return GRAPHQL_TOKENS

    tokens = {
        "fb_dtsg": dtsg_match.group(1),
        "lsd": lsd_match.group(1),
    }
    print(f"  {DIM}Scraped fresh GraphQL tokens{RESET}")
    return tokens


_cached_tokens = None


def get_graphql_tokens():
    """Get fresh GraphQL tokens (cached per session)."""
    global _cached_tokens
    if _cached_tokens is None:
        _cached_tokens = fetch_graphql_tokens()
    return _cached_tokens


def send_reel_dm(recipient_id, reel_url, text=None):
    """Send a reel to a user via DM using GraphQL.

    Sends the reel URL as text — Instagram auto-embeds it as a rich
    reel preview in the DM thread, identical to sharing via the app.
    """
    tokens = get_graphql_tokens()

    # Ensure we have a full URL for the embed
    if not reel_url.startswith("http"):
        reel_url = f"https://www.instagram.com/reel/{reel_url}/"

    if text:
        message = f"{reel_url}\n{text}"
    else:
        message = reel_url

    offline_id = str(random.randint(10**18, 9 * 10**18))
    variables = {
        "ig_thread_igid": None,
        "offline_threading_id": offline_id,
        "recipient_igids": [str(recipient_id)],
        "replied_to_client_context": None,
        "replied_to_item_id": None,
        "reply_to_message_id": None,
        "sampled": None,
        "text": {"sensitive_string_value": message},
        "mentions": [],
        "mentioned_user_ids": [],
        "commands": None,
    }
    form_data = {
        "fb_dtsg": tokens["fb_dtsg"],
        "lsd": tokens["lsd"],
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
            "x-fb-lsd": tokens["lsd"],
        },
    )
    errors = data.get("errors", []) if isinstance(data, dict) else []
    if status != 200 or errors:
        print(f"  {RED}HTTP {status}: {json.dumps(data, indent=2)[:400] if isinstance(data, dict) else str(data)[:400]}{RESET}")
    return status == 200 and len(errors) == 0


# ── Display ──

BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"


# ── Instagrapi reel fetching ──


_ig_client = None


def get_ig_client():
    """Lazy-load the instagrapi client (only when reel browsing is needed)."""
    global _ig_client
    if _ig_client is None:
        print(f"{DIM}Logging in via instagrapi...{RESET}")
        _ig_client = get_client()
    return _ig_client


def fetch_reels_tab(amount=10):
    """Fetch reels from the Reels tab (trending/suggested)."""
    cl = get_ig_client()
    medias = cl.clips(amount=amount)
    return [m for m in medias if m.media_type == 2 and m.product_type == "clips"]


def fetch_reels_explore(amount=20):
    """Fetch reels from the Explore page."""
    cl = get_ig_client()
    medias = cl.explore_page(amount=amount)
    return [m for m in medias if m.media_type == 2 and m.product_type == "clips"]


def fetch_reels_hashtag(tag, amount=20):
    """Fetch recent reels from a hashtag."""
    cl = get_ig_client()
    medias = cl.hashtag_medias_recent(tag, amount=amount)
    return [m for m in medias if m.product_type == "clips"]


def fetch_reels_user(username, amount=20):
    """Fetch reels from a specific user."""
    cl = get_ig_client()
    user_id = cl.user_id_from_username(username)
    return cl.user_clips(user_id, amount=amount)


def display_reels(reels):
    """Display a list of reels for the user to pick from."""
    for i, reel in enumerate(reels):
        user = reel.user.username if reel.user else "unknown"
        caption = (reel.caption_text or "")[:60]
        views = reel.view_count or 0
        likes = reel.like_count or 0
        print(f"  {CYAN}{i + 1:>3}.{RESET} @{user}  {DIM}{caption}{RESET}")
        print(f"       {DIM}{views:,} views · {likes:,} likes{RESET}")


def pick_reel_interactive():
    """Interactive reel picker — choose a source, browse reels, pick one."""
    print(f"\n  {BOLD}Reel sources:{RESET}")
    print(f"    {CYAN}1.{RESET} Reels tab (trending)")
    print(f"    {CYAN}2.{RESET} Explore page")
    print(f"    {CYAN}3.{RESET} Hashtag")
    print(f"    {CYAN}4.{RESET} User's reels")
    print(f"    {CYAN}5.{RESET} Enter URL manually")

    source = input(f"  Pick source (1-5): ").strip()

    if source == "5":
        url = input("  Reel URL or shortcode: ").strip()
        return url if url else None

    reels = []
    if source == "1":
        print(f"  {DIM}Fetching from Reels tab...{RESET}")
        reels = fetch_reels_tab()
    elif source == "2":
        print(f"  {DIM}Fetching from Explore...{RESET}")
        reels = fetch_reels_explore()
    elif source == "3":
        tag = input("  Hashtag (without #): ").strip()
        if not tag:
            return None
        print(f"  {DIM}Fetching #{tag} reels...{RESET}")
        reels = fetch_reels_hashtag(tag)
    elif source == "4":
        username = input("  Username: @").strip()
        if not username:
            return None
        print(f"  {DIM}Fetching @{username}'s reels...{RESET}")
        reels = fetch_reels_user(username)
    else:
        print(f"  {RED}Invalid source{RESET}")
        return None

    if not reels:
        print(f"  {YELLOW}No reels found.{RESET}")
        return None

    print(f"\n  {BOLD}{len(reels)} reels found:{RESET}\n")
    display_reels(reels)

    pick = input(f"\n  Pick a reel (1-{len(reels)}, r = random): ").strip().lower()
    if pick == "r":
        reel = random.choice(reels)
    else:
        try:
            idx = int(pick) - 1
            if idx < 0 or idx >= len(reels):
                print(f"  {RED}Invalid pick{RESET}")
                return None
            reel = reels[idx]
        except ValueError:
            print(f"  {RED}Invalid pick{RESET}")
            return None

    user = reel.user.username if reel.user else "unknown"
    print(f"  {GREEN}Selected:{RESET} @{user} — {(reel.caption_text or '')[:50]}")

    # Return the reel URL for DM sharing (IG auto-embeds it)
    code = reel.code or reel.pk
    return f"https://www.instagram.com/reel/{code}/"


# ── Main ──


def main():
    my_id = ACTIVE["userId"]
    reel_arg = sys.argv[1] if len(sys.argv) > 1 else None

    print(f"\n{BOLD}ShotTaker — Send Reels via DM{RESET}")

    # Step 1: Get mutuals (cached — instant if already fetched within 1hr)
    mutuals = get_mutuals_cached(my_id, rate_limited_request)

    if not mutuals:
        print(f"{RED}Could not fetch lists. Check your cookies/session.{RESET}")
        return

    # Step 3: Print results
    print(f"{'=' * 50}")
    print(f"  {BOLD}{len(mutuals)}{RESET} mutuals found")
    print(f"{'=' * 50}\n")

    if not mutuals:
        print(f"{YELLOW}No mutual follows found.{RESET}")
        return

    for i, p in enumerate(mutuals):
        name = p.get("fullName") or ""
        name_part = f"  {DIM}{name}{RESET}" if name else ""
        print(f"  {GREEN}{i + 1:>3}.{RESET} @{p['username']}{name_part}")

    print(f"\n{DIM}Pick a person to send a reel to. q to quit.{RESET}\n")

    # Send loop
    while True:
        pick = input(f"  {GREEN}#{RESET} Send reel to? (1-{len(mutuals)} or q): ").strip().lower()
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
        print(f"  {BOLD}@{target['username']}{RESET}  {DIM}{target.get('fullName', '')}{RESET}")

        # Get reel — either from CLI arg, interactive picker, or manual URL
        if reel_arg:
            reel_input = reel_arg
            print(f"  Reel: {reel_input}")
        else:
            reel_input = pick_reel_interactive()
            if not reel_input:
                print(f"  {DIM}Skipped{RESET}\n")
                continue

        # Ensure we have a proper reel URL
        reel_url = reel_input
        if not reel_url.startswith("http"):
            reel_url = f"https://www.instagram.com/reel/{reel_url}/"

        # Optional message
        msg = input("  Message (optional, Enter to skip): ").strip() or None

        # Confirm
        confirm = input(f"  Send reel to @{target['username']}? [Y/n]: ").strip().lower()
        if confirm == "n":
            print(f"  {DIM}Cancelled{RESET}\n")
            continue

        print(f"  Sending reel...")
        if send_reel_dm(target["id"], reel_url, msg):
            print(f"  {GREEN}Reel sent to @{target['username']}!{RESET}\n")
        else:
            print(f"  {RED}Failed to send reel{RESET}\n")


if __name__ == "__main__":
    main()
