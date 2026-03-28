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


def send_reel_dm(recipient_id, media_id, text=None):
    """Send a reel to a user via DM with an optional message."""
    form_data = {
        "recipient_users": json.dumps([str(recipient_id)]),
        "action": "send_item",
        "media_id": media_id,
        "media_type": "clips",
    }
    if text:
        form_data["text"] = text

    status, _data = rate_limited_request(
        "https://www.instagram.com/api/v1/direct_v2/threads/broadcast/media_share/",
        method="POST",
        data=form_data,
    )
    return status == 200


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

    # Return the media PK as a string — we'll use it directly as the media_id
    return str(reel.pk)


# ── Main ──


def main():
    my_id = ACTIVE["userId"]
    reel_arg = sys.argv[1] if len(sys.argv) > 1 else None

    print(f"\n{BOLD}ShotTaker — Send Reels via DM{RESET}")

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

        # Resolve media_id — if it's purely numeric it's already a PK from instagrapi
        if reel_input.isdigit():
            media_id = reel_input
        else:
            media_id = resolve_media_id(reel_input)
            if not media_id:
                print(f"  {RED}Could not resolve reel. Check the URL.{RESET}\n")
                continue

        # Optional message
        msg = input("  Message (optional, Enter to skip): ").strip() or None

        # Confirm
        confirm = input(f"  Send reel to @{target['username']}? [Y/n]: ").strip().lower()
        if confirm == "n":
            print(f"  {DIM}Cancelled{RESET}\n")
            continue

        print(f"  Sending reel...")
        if send_reel_dm(target["id"], media_id, msg):
            print(f"  {GREEN}Reel sent to @{target['username']}!{RESET}\n")
        else:
            print(f"  {RED}Failed to send reel{RESET}\n")


if __name__ == "__main__":
    main()
