"""
Test what post data we can actually get from Instagram's API endpoints.
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ihateallyoupos", "A_complete_setup"))
from config import IG_COOKIES, IG_HEADERS

from curl_cffi import requests as curl_requests

session = curl_requests.Session(impersonate="chrome")
session.cookies.update(IG_COOKIES)
session.headers.update(IG_HEADERS)

test_username = "hackcanada"

# ── 1. Check web_profile_info edge_owner_to_timeline_media more closely ──
print("=" * 60)
print("1. web_profile_info — edge_owner_to_timeline_media")
print("=" * 60)

profile_resp = session.get(
    "https://www.instagram.com/api/v1/users/web_profile_info/",
    params={"username": test_username},
)
profile_data = profile_resp.json()
user = profile_data.get("data", {}).get("user", {})
media = user.get("edge_owner_to_timeline_media", {})
print(f"Post count: {media.get('count')}")
print(f"Edges returned: {len(media.get('edges', []))}")
print(f"Has next page: {media.get('page_info', {}).get('has_next_page')}")

if media.get("edges"):
    print("\nFirst post edge keys:")
    print(json.dumps(media["edges"][0], indent=2, default=str)[:2000])

# ── 2. Try the user feed endpoint (v1) ──
print("\n" + "=" * 60)
print("2. /api/v1/feed/user/{user_id}/ — user feed endpoint")
print("=" * 60)

user_id = user.get("id", "")
if user_id:
    feed_resp = session.get(
        f"https://www.instagram.com/api/v1/feed/user/{user_id}/",
        params={"count": 3},
    )
    feed_data = feed_resp.json()
    print(f"Keys in feed response: {list(feed_data.keys())}")

    items = feed_data.get("items", [])
    print(f"Got {len(items)} items")

    if items:
        item = items[0]
        print(f"\nFirst post keys: {sorted(item.keys())}")

        # Extract the interesting bits
        print(f"\n--- Post details ---")
        print(f"  media_type: {item.get('media_type')}")  # 1=photo, 2=video, 8=carousel
        print(f"  caption: {item.get('caption', {}).get('text', '')[:200] if item.get('caption') else 'None'}")
        print(f"  like_count: {item.get('like_count')}")
        print(f"  comment_count: {item.get('comment_count')}")
        print(f"  taken_at: {item.get('taken_at')}")
        print(f"  has location: {item.get('location') is not None}")

        if item.get("location"):
            print(f"  location: {json.dumps(item['location'], default=str)[:300]}")

        # Check for image candidates
        candidates = item.get("image_versions2", {}).get("candidates", [])
        if candidates:
            print(f"  image_versions: {len(candidates)} sizes, largest: {candidates[0].get('width')}x{candidates[0].get('height')}")

        # Check for usertags
        usertags = item.get("usertags", {}).get("in", [])
        print(f"  usertags: {len(usertags)} people tagged")

        # Check for music
        music = item.get("music_metadata")
        if music:
            print(f"  music: {json.dumps(music, default=str)[:300]}")

        print(f"\n--- ALL KEYS in first post item ---")
        for key in sorted(item.keys()):
            val = item[key]
            val_type = type(val).__name__
            if isinstance(val, (dict, list)):
                preview = f"({val_type}, {len(val)} items)"
            elif val is None:
                preview = "None"
            else:
                preview = str(val)[:80]
            print(f"  {key}: {preview}")
