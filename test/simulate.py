#!/usr/bin/env python3
"""
ShotTaker Pipeline Simulation
Interactive terminal UI that walks through the full swipe pipeline:
  1. Load profiles (waterfall: followers → FoF → suggested)
  2. Swipe through them (right = shoot, left = pass)
  3. On swipe right: check relationship → DM or follow+track
  4. Check pending follow-backs
  5. Timeout/unfollow expired pending

Usage: python3 test/simulate.py
"""

import json
import math
import random
import time
import urllib.parse
import urllib.request
import ssl

from config import ACCOUNTS, GRAPHQL_TOKENS

ACTIVE = ACCOUNTS[1]

RATE_LIMIT_DELAY = 2.5  # seconds between API calls

# ── State ──

seen_profiles = set()
pending_follows = []  # list of dicts: {userId, username, fullName, followedAt, dmTemplate, status, retries}
shot_history = []
dm_template = "Hey! I came across your profile and had to say hi 👋"

# ── HTTP helpers ──

ssl_ctx = ssl.create_default_context()

last_call_time = 0


def rate_limited_request(url, method="GET", data=None, extra_headers=None):
    """Make a rate-limited request to Instagram API."""
    global last_call_time

    elapsed = time.time() - last_call_time
    if elapsed < RATE_LIMIT_DELAY:
        wait = RATE_LIMIT_DELAY - elapsed
        print(f"  (rate limit: waiting {wait:.1f}s)")
        time.sleep(wait)
    last_call_time = time.time()

    headers = {
        "x-ig-app-id": "936619743392459",
        "x-requested-with": "XMLHttpRequest",
        "x-csrftoken": ACTIVE["csrftoken"],
        "cookie": ACTIVE["cookies"],
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        "referer": "https://www.instagram.com/",
        "origin": "https://www.instagram.com",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    }
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


def get_followers(user_id, count=25, max_id=None):
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
            "profilePic": u.get("profile_pic_url", ""),
            "isPrivate": u.get("is_private", False),
        }
        for u in data.get("users", [])
    ]
    return users, data.get("next_max_id")


def get_all_followers(user_id, limit=200):
    all_users = []
    max_id = None
    while True:
        users, max_id = get_followers(user_id, 200, max_id)
        all_users.extend(users)
        if not max_id or len(all_users) >= limit:
            break
    return all_users[:limit]


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


def get_all_following(user_id, limit=500):
    all_users = []
    max_id = None
    while True:
        users, max_id = get_following(user_id, 200, max_id)
        all_users.extend(users)
        if not max_id or len(all_users) >= limit:
            break
    return all_users[:limit]


def get_suggested_users():
    url = "https://www.instagram.com/api/v1/discover/ayml/"
    status, data = rate_limited_request(
        url, method="POST", data={"phone_id": "", "module": "discover_people"}
    )
    if status != 200:
        print(f"  [ERR] get_suggested: {status}")
        return []
    users = []
    for item in data.get("suggested_users", {}).get("suggestions", []):
        u = item.get("user")
        if u:
            users.append(
                {
                    "id": str(u.get("pk") or u.get("pk_id")),
                    "username": u.get("username"),
                    "fullName": u.get("full_name", ""),
                    "isPrivate": u.get("is_private", False),
                }
            )
    return users


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
        "isBusiness": user.get("is_business_account", False),
        "isProfessional": user.get("is_professional_account", False),
        "categoryName": user.get("category_name") or user.get("business_category_name"),
        "pronouns": user.get("pronouns", []),
        "externalUrl": user.get("external_url"),
        "mutualFollowers": (user.get("edge_mutual_followed_by") or {}).get("count", 0),
        "mutualFollowerNames": [e.get("node", {}).get("username") for e in mutual_edges],
        "followedByViewer": user.get("followed_by_viewer", False),
        "followsViewer": user.get("follows_viewer", False),
        "highlightReelCount": user.get("highlight_reel_count", 0),
        "isJoinedRecently": user.get("is_joined_recently", False),
    }


def get_user_posts(user_id, count=6):
    url = f"https://www.instagram.com/api/v1/feed/user/{user_id}/?count={count}"
    status, data = rate_limited_request(url)
    if status != 200:
        print(f"  [ERR] get_user_posts: {status}")
        return []
    posts = []
    for item in data.get("items", []):
        candidates = (item.get("image_versions2") or {}).get("candidates", [])
        best = candidates[0] if candidates else {}
        location = item.get("location")
        music = item.get("music_metadata")
        music_info = (music or {}).get("music_info", {}).get("music_asset_info", {})
        posts.append({
            "id": item.get("pk"),
            "mediaType": item.get("media_type"),  # 1=photo, 2=video, 8=carousel
            "imageUrl": best.get("url"),
            "caption": (item.get("caption") or {}).get("text"),
            "likeCount": item.get("like_count", 0),
            "commentCount": item.get("comment_count", 0),
            "playCount": item.get("play_count", 0),
            "takenAt": item.get("taken_at"),
            "location": {
                "name": location.get("name"),
                "city": location.get("city"),
                "lat": location.get("lat"),
                "lng": location.get("lng"),
            } if location else None,
            "usertags": [
                {"username": t.get("user", {}).get("username"), "id": t.get("user", {}).get("pk")}
                for t in (item.get("usertags") or {}).get("in", [])
            ],
            "music": {
                "title": music_info.get("title"),
                "artist": music_info.get("display_artist"),
            } if music_info.get("title") else None,
            "isPaidPartnership": item.get("is_paid_partnership", False),
            "productType": item.get("product_type"),  # "clips" = reel
            "coauthors": [
                {"username": c.get("username"), "id": c.get("pk")}
                for c in (item.get("coauthor_producers") or [])
            ],
        })
    return posts


def check_relationship(user_id):
    url = f"https://www.instagram.com/api/v1/friendships/show/{user_id}/"
    status, data = rate_limited_request(url)
    if status != 200:
        print(f"  [ERR] check_relationship: {status}")
        return {"followedBy": False, "following": False, "outgoingRequest": False}
    return {
        "followedBy": bool(data.get("followed_by")),
        "following": bool(data.get("following")),
        "outgoingRequest": bool(data.get("outgoing_request")),
    }


def follow_user(user_id):
    url = f"https://www.instagram.com/api/v1/friendships/create/{user_id}/"
    status, data = rate_limited_request(
        url, method="POST", data={"container_module": "profile", "user_id": user_id}
    )
    return status == 200


def unfollow_user(user_id):
    url = f"https://www.instagram.com/api/v1/friendships/destroy/{user_id}/"
    status, data = rate_limited_request(
        url, method="POST", data={"container_module": "profile", "user_id": user_id}
    )
    return status == 200


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


# ── Pipeline helpers ──


def filter_and_dedupe(profiles):
    unique = {}
    for p in profiles:
        pid = p["id"]
        if pid in seen_profiles:
            continue
        if p.get("isPrivate"):
            continue
        if pid == ACTIVE["userId"]:
            continue
        if pid not in unique:
            unique[pid] = p
    return list(unique.values())


def format_count(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return str(n)


def time_since(ts):
    secs = int(time.time() - ts)
    if secs < 60:
        return f"{secs}s"
    mins = secs // 60
    if mins < 60:
        return f"{mins}m"
    hours = mins // 60
    if hours < 24:
        return f"{hours}h"
    return f"{hours // 24}d"


# ── Display ──

BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"


def print_header(text):
    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"{BOLD}  {text}{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}")


def print_profile_card(profile, index, total):
    print(f"\n{CYAN}{'─' * 50}{RESET}")
    # Name + verification
    name = profile.get("fullName") or profile["username"]
    verified = " ✓" if profile.get("isVerified") else ""
    print(f"  {BOLD}{name}{verified}{RESET}")
    print(f"  @{profile['username']}  {DIM}({profile['id']}){RESET}")

    # Badges: pronouns, category, business
    badges = []
    if profile.get("pronouns"):
        badges.append("/".join(profile["pronouns"]))
    if profile.get("categoryName"):
        badges.append(profile["categoryName"])
    if profile.get("isBusiness") or profile.get("isProfessional"):
        badges.append("Professional" if profile.get("isProfessional") else "Business")
    if badges:
        print(f"  {DIM}{' · '.join(badges)}{RESET}")

    # Bio
    if profile.get("bio"):
        bio = profile["bio"][:120]
        print(f"  {DIM}{bio}{RESET}")

    # External URL
    if profile.get("externalUrl"):
        print(f"  🔗 {DIM}{profile['externalUrl']}{RESET}")

    # Stats row
    stats = []
    if profile.get("followers") is not None:
        stats.append(f"{format_count(profile['followers'])} followers")
    if profile.get("following") is not None:
        stats.append(f"{format_count(profile['following'])} following")
    if profile.get("postCount"):
        stats.append(f"{format_count(profile['postCount'])} posts")
    if stats:
        print(f"  {' | '.join(stats)}")

    # Mutual followers
    if profile.get("mutualFollowers", 0) > 0:
        names = profile.get("mutualFollowerNames", [])
        mutual_str = f"{profile['mutualFollowers']} mutual"
        if names:
            mutual_str += f" incl. @{', @'.join(names[:3])}"
        print(f"  {CYAN}{mutual_str}{RESET}")

    # Relationship
    rel_parts = []
    if profile.get("followedByViewer"):
        rel_parts.append(f"{GREEN}you follow them{RESET}")
    if profile.get("followsViewer"):
        rel_parts.append(f"{GREEN}they follow you{RESET}")
    if rel_parts:
        print(f"  {' | '.join(rel_parts)}")

    # Recent posts
    posts = profile.get("recentPosts", [])
    if posts:
        total_likes = sum(p.get("likeCount", 0) for p in posts)
        avg_likes = total_likes // len(posts) if posts else 0
        print(f"\n  {BOLD}Recent posts ({len(posts)}):{RESET}  avg {format_count(avg_likes)} likes")

        # Locations from posts
        locations = list({p["location"]["name"] for p in posts if p.get("location") and p["location"].get("name")})
        if locations:
            print(f"  📍 {', '.join(locations[:3])}")

        # Show each post
        for j, post in enumerate(posts[:4]):
            media_icon = "📷" if post.get("mediaType") == 1 else "🎬" if post.get("mediaType") == 2 else "📑"
            caption = (post.get("caption") or "")[:80]
            likes = format_count(post.get("likeCount", 0))
            comments = format_count(post.get("commentCount", 0))
            plays = f" | {format_count(post['playCount'])} plays" if post.get("playCount") else ""

            age = ""
            if post.get("takenAt"):
                age = time_since(post["takenAt"])

            print(f"    {media_icon} {DIM}{age} ago{RESET} — ❤ {likes} 💬 {comments}{plays}")
            if caption:
                print(f"       {DIM}\"{caption}\"{RESET}")

            # Tags, music, collabs
            extras = []
            if post.get("usertags"):
                tag_names = [t["username"] for t in post["usertags"] if t.get("username")]
                if tag_names:
                    extras.append(f"tagged: @{', @'.join(tag_names[:3])}")
            if post.get("music"):
                extras.append(f"🎵 {post['music']['title']} — {post['music']['artist']}")
            if post.get("coauthors"):
                collab_names = [c["username"] for c in post["coauthors"] if c.get("username")]
                if collab_names:
                    extras.append(f"collab: @{', @'.join(collab_names)}")
            if post.get("isPaidPartnership"):
                extras.append("💰 paid partnership")
            if extras:
                print(f"       {DIM}{' | '.join(extras)}{RESET}")

    # Highlight reels
    if profile.get("highlightReelCount"):
        print(f"  {profile['highlightReelCount']} highlight reels")

    if profile.get("isJoinedRecently"):
        print(f"  {YELLOW}⚠ Joined recently{RESET}")

    print(f"  {DIM}Card {index + 1} of {total}{RESET}")
    print(f"{CYAN}{'─' * 50}{RESET}")


def print_pending_list():
    active = [p for p in pending_follows if p["status"] == "pending"]
    if not active:
        print(f"  {DIM}No pending follow-backs{RESET}")
        return
    for p in active:
        ago = time_since(p["followedAt"])
        print(f"  @{p['username']} — followed {ago} ago")


# ── Swipe right logic (mirrors content.js onSwipeRight) ──


def handle_swipe_right(profile):
    seen_profiles.add(profile["id"])

    print(f"\n  Checking relationship with @{profile['username']}...")
    rel = check_relationship(profile["id"])

    print(
        f"  followedBy={rel['followedBy']}  following={rel['following']}  outgoing={rel['outgoingRequest']}"
    )

    if rel["followedBy"]:
        # They follow us — DM immediately
        print(f"\n  {GREEN}They follow you! Sending DM...{RESET}")
        msg = input(f"  Message [{dm_template[:40]}...]: ").strip() or dm_template
        success = send_dm_graphql(profile["id"], msg)
        if success:
            print(f"  {GREEN}Shot sent to @{profile['username']}! 💘{RESET}")
            shot_history.append(
                {
                    "username": profile["username"],
                    "timestamp": time.time(),
                    "method": "direct_dm",
                }
            )
        else:
            print(f"  {RED}Failed to send DM{RESET}")
    else:
        # They don't follow us — follow them and track
        print(f"\n  {YELLOW}They don't follow you yet.{RESET}")
        confirm = input("  Follow them and queue DM for follow-back? [Y/n]: ").strip()
        if confirm.lower() == "n":
            print("  Skipped.")
            return

        print(f"  Following @{profile['username']}...")
        if follow_user(profile["id"]):
            pending_follows.append(
                {
                    "userId": profile["id"],
                    "username": profile["username"],
                    "fullName": profile.get("fullName", ""),
                    "followedAt": time.time(),
                    "dmTemplate": dm_template,
                    "status": "pending",
                    "retries": 0,
                }
            )
            print(
                f"  {GREEN}Followed! Will DM when they follow back (checking every 5 min){RESET}"
            )
        else:
            print(f"  {RED}Failed to follow{RESET}")


def handle_swipe_left(profile):
    seen_profiles.add(profile["id"])
    print(f"  {DIM}Passed on @{profile['username']}{RESET}")


# ── Pending follow-back check (mirrors background.js processPendingFollows) ──

TIMEOUT_SECS = 48 * 60 * 60  # 48 hours
MAX_RETRIES = 3


def check_pending_followbacks():
    active = [p for p in pending_follows if p["status"] == "pending"]
    if not active:
        print(f"  {DIM}No pending follow-backs to check{RESET}")
        return

    print(f"\n  Checking {len(active)} pending follow-backs...")
    now = time.time()

    for entry in active:
        # Timeout check
        if now - entry["followedAt"] > TIMEOUT_SECS:
            print(
                f"  {RED}@{entry['username']} timed out (48h) — unfollowing...{RESET}"
            )
            unfollow_user(entry["userId"])
            entry["status"] = "expired"
            continue

        # Check if they followed back
        print(f"  Checking @{entry['username']}...")
        rel = check_relationship(entry["userId"])

        if rel["followedBy"]:
            print(
                f"  {GREEN}@{entry['username']} followed back! Sending DM...{RESET}"
            )
            success = send_dm_graphql(entry["userId"], entry["dmTemplate"])
            if success:
                entry["status"] = "sent"
                shot_history.append(
                    {
                        "username": entry["username"],
                        "timestamp": time.time(),
                        "method": "follow_back_dm",
                    }
                )
                print(f"  {GREEN}Shot sent to @{entry['username']}! 💘{RESET}")
            else:
                entry["retries"] += 1
                print(
                    f"  {RED}DM failed (retry {entry['retries']}/{MAX_RETRIES}){RESET}"
                )
                if entry["retries"] >= MAX_RETRIES:
                    entry["status"] = "expired"
                    unfollow_user(entry["userId"])
                    print(f"  {RED}Max retries — unfollowed @{entry['username']}{RESET}")
        else:
            ago = time_since(entry["followedAt"])
            print(f"  {DIM}@{entry['username']} — no follow-back yet ({ago}){RESET}")


# ── Waterfall profile loading ──


def load_profiles_waterfall(enrich=True, enrich_limit=5):
    """Load profiles in tiers: followers → FoF → suggested.
    enrich_limit controls how many to enrich per tier (saves API calls in testing).
    """
    my_id = ACTIVE["userId"]
    all_profiles = []

    # Tier 1: My followers
    print(f"\n{BOLD}Tier 1: Your followers{RESET}")
    followers = get_all_followers(my_id, limit=50)
    print(f"  Fetched {len(followers)} followers")
    tier1 = filter_and_dedupe(followers)
    print(f"  After filter: {len(tier1)} swipeable")

    if enrich and tier1:
        print(f"  Enriching top {min(enrich_limit, len(tier1))}...")
        for p in tier1[:enrich_limit]:
            info = get_profile_info(p["username"])
            if info:
                p.update(info)
                posts = get_user_posts(info["id"], 6)
                p["recentPosts"] = posts
    all_profiles.extend(tier1)

    # Tier 2: Friends of friends
    print(f"\n{BOLD}Tier 2: Friends of friends{RESET}")
    following = get_all_following(my_id, limit=100)
    print(f"  You follow {len(following)} people")
    sampled = random.sample(following, min(3, len(following)))
    print(f"  Sampling {len(sampled)} to get their followers")

    fof = []
    for f in sampled:
        print(f"  Fetching followers of @{f['username']}...")
        f_followers, _ = get_followers(f["id"], 25)
        fof.extend(f_followers)

    tier2 = filter_and_dedupe(fof)
    # Also exclude tier1 profiles
    tier1_ids = {p["id"] for p in tier1}
    tier2 = [p for p in tier2 if p["id"] not in tier1_ids]
    print(f"  After filter: {len(tier2)} new profiles")

    if enrich and tier2:
        print(f"  Enriching top {min(enrich_limit, len(tier2))}...")
        for p in tier2[:enrich_limit]:
            info = get_profile_info(p["username"])
            if info:
                p.update(info)
                posts = get_user_posts(info["id"], 6)
                p["recentPosts"] = posts
    all_profiles.extend(tier2)

    # Tier 3: Suggested
    print(f"\n{BOLD}Tier 3: Suggested users{RESET}")
    suggested = get_suggested_users()
    print(f"  Fetched {len(suggested)} suggested")
    prev_ids = {p["id"] for p in all_profiles}
    tier3 = [p for p in filter_and_dedupe(suggested) if p["id"] not in prev_ids]
    print(f"  After filter: {len(tier3)} new profiles")

    if enrich and tier3:
        print(f"  Enriching top {min(enrich_limit, len(tier3))}...")
        for p in tier3[:enrich_limit]:
            info = get_profile_info(p["username"])
            if info:
                p.update(info)
                posts = get_user_posts(info["id"], 6)
                p["recentPosts"] = posts
    all_profiles.extend(tier3)

    print(f"\n{GREEN}Total: {len(all_profiles)} profiles loaded across 3 tiers{RESET}")
    return all_profiles


# ── Main — load then swipe, like the real UI ──


def main():
    print(f"\n{BOLD}🎯 ShotTaker{RESET}")
    print(f"{DIM}Loading profiles...{RESET}\n")

    profiles = load_profiles_waterfall(enrich=True, enrich_limit=10)

    if not profiles:
        print(f"\n{RED}No profiles found. Check your cookies/session.{RESET}")
        return

    print(f"\n{GREEN}{len(profiles)} profiles ready.{RESET}")
    print(f"{DIM}Swipe:  {GREEN}r{RESET}{DIM} = shoot your shot  {RED}l{RESET}{DIM} = pass  {DIM}q = quit{RESET}\n")

    i = 0
    while i < len(profiles):
        p = profiles[i]
        print_profile_card(p, i, len(profiles))

        action = input(f"  {GREEN}→{RESET} shoot  /  {RED}←{RESET} pass  /  quit?  ").strip().lower()

        if action in ("r", "right", "→", ""):
            handle_swipe_right(p)
            i += 1
        elif action in ("l", "left", "←"):
            handle_swipe_left(p)
            i += 1
        elif action in ("q", "quit"):
            break
        else:
            print(f"  {DIM}r = shoot, l = pass, q = quit{RESET}")

    # Summary
    print(f"\n{CYAN}{'─' * 50}{RESET}")
    print(f"  {BOLD}Session done{RESET}")
    print(f"  Profiles seen: {len(seen_profiles)}")
    print(f"  Shots fired:   {len(shot_history)}")
    pending = [p for p in pending_follows if p["status"] == "pending"]
    if pending:
        print(f"  Pending follow-backs: {len(pending)}")
        for p in pending:
            print(f"    @{p['username']}")
    if shot_history:
        print(f"\n  {BOLD}Shots:{RESET}")
        for s in shot_history:
            print(f"    💘 @{s['username']} ({s['method']})")
    print(f"{CYAN}{'─' * 50}{RESET}\n")


if __name__ == "__main__":
    main()
