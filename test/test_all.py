#!/usr/bin/env python3
"""
ShotTaker — All-in-one test runner (fully automated).

Runs all 6 features end-to-end with hardcoded values. No interaction needed.
  1. AI Image Generation (FLUX.1-Kontext-pro)
  2. Love Confession DM (Azure GPT-4.1-mini → GraphQL DM)
  3. Story Image Posting (AI-generate → upload)
  4. Story Reel Posting (download reel → repost as story)
  5. Commenting on Reels
  6. Shitty Shottaker (AI confession → DM)

Usage: python test/test_all.py
"""

import json
import os
import random
import re
import sys
import time
import tempfile
import base64
import urllib.parse
import urllib.request
import ssl
from pathlib import Path

import requests
from openai import AzureOpenAI
from dotenv import load_dotenv

# Ensure test/ directory is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from config import ACCOUNTS, GRAPHQL_TOKENS, headers as config_headers
from cache import get_mutuals_cached

# ── Constants ──

ACTIVE = ACCOUNTS[0]
DELAY_READ = 0.5
DELAY_WRITE = 3.0

BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"

PROFILES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "profiles.json")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

# ── Azure OpenAI ──

azure_client = AzureOpenAI(
    api_version="2024-12-01-preview",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
)

# ── HTTP helpers ──

ssl_ctx = ssl.create_default_context()
last_call_time = 0


def rate_limited_request(url, method="GET", data=None, extra_headers=None):
    global last_call_time
    is_write = method == "POST"
    min_delay = DELAY_WRITE if is_write else DELAY_READ
    elapsed = time.time() - last_call_time
    if elapsed < min_delay:
        wait = min_delay - elapsed
        print(f"  {DIM}(rate limit: {wait:.1f}s){RESET}")
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
        raw = resp.read().decode()
        try:
            body = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            body = {"raw": raw[:500]}
        return resp.status, body
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()[:500]
        try:
            body = json.loads(body_text)
        except Exception:
            body = body_text
        return e.code, body


# ── Profile helpers ──

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


def enrich_and_show(target, cache):
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
    print(f"  {info['followers']} followers | {info['following']} following | {info['postCount']} posts")
    if info.get("mutualFollowers", 0) > 0:
        names = info.get("mutualFollowerNames", [])
        mutual_str = f"{info['mutualFollowers']} mutual"
        if names:
            mutual_str += f" incl. @{', @'.join(names[:3])}"
        print(f"  {CYAN}{mutual_str}{RESET}")
    if info.get("profilePic"):
        print(f"  {DIM}pic: {info['profilePic'][:80]}...{RESET}")
    return info


# ── GraphQL token scraping ──

_cached_tokens = None


def fetch_graphql_tokens():
    """Scrape fresh fb_dtsg and lsd tokens from Instagram page."""
    print(f"  {DIM}Scraping fresh GraphQL tokens...{RESET}")
    headers = config_headers()
    req = urllib.request.Request("https://www.instagram.com/", headers=headers)
    resp = urllib.request.urlopen(req, context=ssl_ctx)
    html = resp.read().decode("utf-8", errors="replace")

    dtsg_match = re.search(r'"DTSGInitialData".*?"token":"([^"]+)"', html)
    lsd_match = re.search(r'"LSD".*?"token":"([^"]+)"', html)

    if not dtsg_match or not lsd_match:
        dtsg_match = dtsg_match or re.search(r'fb_dtsg["\s:]+value["\s:]+([^"&]+)', html)
        lsd_match = lsd_match or re.search(r'"lsd":"([^"]+)"', html)

    if not dtsg_match or not lsd_match:
        print(f"  {RED}Could not scrape tokens — falling back to .env{RESET}")
        return GRAPHQL_TOKENS

    tokens = {
        "fb_dtsg": dtsg_match.group(1),
        "lsd": lsd_match.group(1),
    }
    print(f"  {GREEN}Got fresh tokens{RESET}")
    return tokens


def get_graphql_tokens():
    """Get fresh GraphQL tokens (cached per session)."""
    global _cached_tokens
    if _cached_tokens is None:
        _cached_tokens = fetch_graphql_tokens()
    return _cached_tokens


# ── DM sending ──

def send_dm_graphql(recipient_id, text):
    tokens = get_graphql_tokens()
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
    # Validate: must be 200, must have actual data (not empty), no errors
    if status != 200:
        print(f"  {RED}HTTP {status}{RESET}")
        return False
    if not isinstance(data, dict) or data.get("raw"):
        print(f"  {RED}Non-JSON response — tokens likely stale{RESET}")
        return False
    errors = data.get("errors", [])
    if errors:
        print(f"  {RED}GraphQL errors: {errors[0].get('message', errors)}{RESET}")
        return False
    return True


# ── AI confession ──

def generate_confession(username, full_name=None, bio=None):
    name = full_name or username
    context = f"Their name is {name} (Instagram: @{username})."
    if bio:
        context += f' Their bio says: "{bio}"'
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
            {"role": "user", "content": f"Write a love confession DM. {context}"},
        ],
        max_tokens=100,
        temperature=0.9,
    )
    return resp.choices[0].message.content.strip()


# ── Commenting ──

def comment_on_post(media_id, text):
    resp = requests.post(
        f"https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
        headers={**config_headers(), "content-type": "application/x-www-form-urlencoded"},
        data={"comment_text": text},
    )
    if resp.ok:
        data = resp.json()
        return True, data
    return False, resp.text[:500]


def shortcode_to_media_id(shortcode):
    ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    media_id = 0
    for char in shortcode:
        media_id = media_id * 64 + ALPHABET.index(char)
    return str(media_id)


def resolve_media_id(reel_url_or_shortcode):
    shortcode = reel_url_or_shortcode.strip().rstrip("/")
    for prefix in ("/reel/", "/reels/", "/p/"):
        if prefix in shortcode:
            shortcode = shortcode.split(prefix)[-1].split("/")[0].split("?")[0]
            break
    try:
        return shortcode_to_media_id(shortcode)
    except (ValueError, IndexError):
        pass
    status, data = rate_limited_request(f"https://www.instagram.com/api/v1/media/{shortcode}/info/")
    if status == 200 and isinstance(data, dict):
        items = data.get("items", [])
        if items:
            return str(items[0].get("pk") or items[0].get("id"))
    return None


# ── Image generation ──

AZURE_IMG_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/") + "/openai/deployments/FLUX.1-Kontext-pro/images/generations"
AZURE_IMG_API_VERSION = "2025-04-01-preview"
AZURE_IMG_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")


def generate_image(prompt, size="1024x1024"):
    print(f"  {DIM}Generating image...{RESET}")
    print(f"  Prompt: \"{prompt}\"")
    resp = requests.post(
        AZURE_IMG_ENDPOINT,
        params={"api-version": AZURE_IMG_API_VERSION},
        headers={"api-key": AZURE_IMG_API_KEY, "Content-Type": "application/json"},
        json={"prompt": prompt, "size": size, "n": 1},
    )
    if not resp.ok:
        print(f"  {RED}FAILED: {resp.status_code} — {resp.text[:300]}{RESET}")
        return None
    data = resp.json()
    images = data.get("data", [])
    if not images:
        print(f"  {RED}No images in response{RESET}")
        return None

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    img = images[0]
    ts = int(time.time())
    filepath = os.path.join(OUTPUT_DIR, f"gen_{ts}.png")

    if img.get("b64_json"):
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(img["b64_json"]))
    elif img.get("url"):
        img_resp = requests.get(img["url"])
        if img_resp.ok:
            with open(filepath, "wb") as f:
                f.write(img_resp.content)
        else:
            print(f"  {RED}Failed to download{RESET}")
            return None
    else:
        print(f"  {RED}Unknown image format{RESET}")
        return None

    print(f"  {GREEN}Saved: {filepath}{RESET}")
    return filepath


# ── Instagrapi helpers ──

_ig_client = None


def get_ig_client():
    global _ig_client
    if _ig_client is None:
        from ig_auth import get_client
        print(f"  {DIM}Logging in via instagrapi...{RESET}")
        _ig_client = get_client()
    return _ig_client


def upload_story_photo(file_path, caption=""):
    cl = get_ig_client()
    result = cl.photo_upload_to_story(str(file_path), caption)
    return result


def upload_story_video(file_path, caption=""):
    cl = get_ig_client()
    result = cl.video_upload_to_story(str(file_path), caption)
    return result


def download_reel(shortcode):
    cl = get_ig_client()
    media_pk = cl.media_pk_from_code(shortcode)
    tmp_dir = Path(tempfile.mkdtemp())
    video_path = cl.clip_download(media_pk, folder=tmp_dir)
    return video_path, tmp_dir


# ── Hardcoded test values ──

TEST_IMAGE_PROMPT = "a golden retriever wearing sunglasses at sunset"
TEST_STORY_PROMPT = "aesthetic lo-fi anime girl studying at night with city lights"
TEST_REEL_SHORTCODE = "DWZkVB5gXdx"
TEST_COMMENT_TEXT = "fire 🔥"
CONFESSION_TARGET_IDX = 0   # first mutual (alphabetical)
SHOTTAKER_TARGET_IDX = 1    # second mutual


# ══════════════════════════════════════════════════
#  TEST 1: AI Image Generation
# ══════════════════════════════════════════════════

def test_image_gen():
    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"  {BOLD}TEST 1: AI Image Generation{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}\n")

    filepath = generate_image(TEST_IMAGE_PROMPT)
    if filepath:
        print(f"  {GREEN}PASS{RESET}")
    else:
        print(f"  {RED}FAIL{RESET}")
    return filepath


# ══════════════════════════════════════════════════
#  TEST 2: Love Confession DM
# ══════════════════════════════════════════════════

def test_love_confession(mutuals, profile_cache):
    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"  {BOLD}TEST 2: Love Confession DM{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}\n")

    target = mutuals[CONFESSION_TARGET_IDX]
    info = enrich_and_show(target, profile_cache)

    print(f"\n  {DIM}Generating confession...{RESET}")
    bio = (info or {}).get("bio", "")
    msg = generate_confession(target["username"], target.get("fullName"), bio)
    print(f"  {CYAN}\"{msg}\"{RESET}")
    print(f"  Sending to @{target['username']}...")

    if send_dm_graphql(target["id"], msg):
        print(f"  {GREEN}PASS — sent to @{target['username']}{RESET}")
    else:
        print(f"  {RED}FAIL — DM send failed{RESET}")


# ══════════════════════════════════════════════════
#  TEST 3: Story Image Posting
# ══════════════════════════════════════════════════

def test_story_image():
    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"  {BOLD}TEST 3: Story Image Posting{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}\n")

    filepath = generate_image(TEST_STORY_PROMPT)
    if not filepath:
        print(f"  {RED}FAIL — image gen failed{RESET}")
        return

    print(f"  Uploading to story...")
    try:
        result = upload_story_photo(filepath)
        print(f"  {GREEN}PASS — Story posted! Media ID: {result.id}{RESET}")
    except Exception as e:
        print(f"  {RED}FAIL — {e}{RESET}")


# ══════════════════════════════════════════════════
#  TEST 4: Story Reel Posting
# ══════════════════════════════════════════════════

def test_story_reel():
    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"  {BOLD}TEST 4: Story Reel Posting{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}\n")

    print(f"  Shortcode: {TEST_REEL_SHORTCODE}")
    print(f"  {DIM}Downloading reel...{RESET}")
    try:
        video_path, tmp_dir = download_reel(TEST_REEL_SHORTCODE)
        print(f"  Downloaded: {video_path}")
    except Exception as e:
        print(f"  {RED}FAIL — download: {e}{RESET}")
        return

    print(f"  Uploading to story...")
    try:
        result = upload_story_video(str(video_path), "")
        print(f"  {GREEN}PASS — Story posted! Media ID: {result.id}{RESET}")
    except Exception as e:
        print(f"  {RED}FAIL — upload: {e}{RESET}")
    finally:
        for f in tmp_dir.iterdir():
            f.unlink()
        tmp_dir.rmdir()


# ══════════════════════════════════════════════════
#  TEST 5: Commenting on Reels
# ══════════════════════════════════════════════════

def test_comment():
    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"  {BOLD}TEST 5: Comment on a Reel{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}\n")

    media_id = resolve_media_id(TEST_REEL_SHORTCODE)
    if not media_id:
        print(f"  {RED}FAIL — could not resolve media ID{RESET}")
        return
    print(f"  Media ID: {media_id}")
    print(f"  Comment: \"{TEST_COMMENT_TEXT}\"")

    print(f"  Posting comment...")
    success, data = comment_on_post(media_id, TEST_COMMENT_TEXT)
    if success:
        print(f"  {GREEN}PASS — comment posted!{RESET}")
    else:
        print(f"  {RED}FAIL — {data}{RESET}")


# ══════════════════════════════════════════════════
#  TEST 6: Shitty Shottaker
# ══════════════════════════════════════════════════

def test_shottaker(mutuals, profile_cache):
    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"  {BOLD}TEST 6: Shitty Shottaker{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}\n")

    target = mutuals[SHOTTAKER_TARGET_IDX]
    info = enrich_and_show(target, profile_cache)

    print(f"\n  {DIM}Generating confession...{RESET}")
    bio = (info or {}).get("bio", "")
    msg = generate_confession(target["username"], target.get("fullName"), bio)
    print(f"  {CYAN}\"{msg}\"{RESET}")
    print(f"  Sending to @{target['username']}...")

    if send_dm_graphql(target["id"], msg):
        print(f"  {GREEN}PASS — sent to @{target['username']}{RESET}")
    else:
        print(f"  {RED}FAIL — DM send failed{RESET}")


# ══════════════════════════════════════════════════
#  RUN ALL
# ══════════════════════════════════════════════════

def main():
    my_id = ACTIVE["userId"]

    print(f"\n{BOLD}ShotTaker — Run All Tests{RESET}\n")

    # Load mutuals (cached)
    print(f"{DIM}Loading mutuals...{RESET}")
    mutuals = get_mutuals_cached(my_id, rate_limited_request)
    profile_cache = load_profile_cache()
    print(f"  {GREEN}{len(mutuals)} mutuals loaded{RESET}")

    print(f"\n  Confession target:  @{mutuals[CONFESSION_TARGET_IDX]['username']}")
    print(f"  Shottaker target:   @{mutuals[SHOTTAKER_TARGET_IDX]['username']}")
    print(f"  Reel shortcode:     {TEST_REEL_SHORTCODE}")
    print(f"  Image prompt:       \"{TEST_IMAGE_PROMPT}\"")
    print(f"  Story prompt:       \"{TEST_STORY_PROMPT}\"")
    print(f"  Comment text:       \"{TEST_COMMENT_TEXT}\"\n")

    test_image_gen()
    test_love_confession(mutuals, profile_cache)
    test_story_image()
    test_story_reel()
    test_comment()
    test_shottaker(mutuals, profile_cache)

    print(f"\n{BOLD}{'=' * 50}{RESET}")
    print(f"  {BOLD}All 6 tests complete.{RESET}")
    print(f"{BOLD}{'=' * 50}{RESET}\n")


if __name__ == "__main__":
    main()
