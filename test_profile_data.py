"""
Quick test: see exactly what data comes back from Instagram's profile enrichment
and following endpoints using the session from ihateallyoupos config.
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

# ── 1. Test: Enrich a profile via web_profile_info ────────────────────
print("\n" + "=" * 60)
print("2. PROFILE ENRICHMENT (web_profile_info)")
print("=" * 60)

test_username = "hackcanada"  # known public account

profile_resp = session.get(
    "https://www.instagram.com/api/v1/users/web_profile_info/",
    params={"username": test_username},
    headers={
        "accept": "*/*",
        "referer": f"https://www.instagram.com/{test_username}/",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    },
)
profile_data = profile_resp.json()

# Print the full structure so you can see every field available
print(json.dumps(profile_data, indent=2, default=str)[:5000])

# ── 3. Summarize the available fields ─────────────────────────────────
print("\n" + "=" * 60)
print("3. ALL TOP-LEVEL KEYS in profile_data['data']['user']:")
print("=" * 60)
user_obj = profile_data.get("data", {}).get("user", {})
for key in sorted(user_obj.keys()):
    val = user_obj[key]
    val_type = type(val).__name__
    preview = str(val)[:80] if not isinstance(val, (dict, list)) else f"({val_type}, {len(val)} items)"
    print(f"  {key}: {preview}")

# ── 4. Test: Get following list (first page) ─────────────────────────
print("\n" + "=" * 60)
print("4. FOLLOWING LIST (first page)")
print("=" * 60)

user_id = user_obj.get("id", "")
if user_id:
    following_resp = session.get(
        f"https://www.instagram.com/api/v1/friendships/{user_id}/following/",
        params={"count": 5, "search_surface": "follow_list_page"},
        headers={
            "accept": "*/*",
            "referer": f"https://www.instagram.com/{test_username}/following/",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
        },
    )
    following_data = following_resp.json()

    print(f"\nKeys in following response: {list(following_data.keys())}")
    users = following_data.get("users", [])
    print(f"Got {len(users)} users in this page")

    if users:
        print("\nFIRST USER OBJECT (all fields):")
        print(json.dumps(users[0], indent=2, default=str)[:3000])

        print("\nALL KEYS in a following user object:")
        for key in sorted(users[0].keys()):
            val = users[0][key]
            val_type = type(val).__name__
            preview = str(val)[:80] if not isinstance(val, (dict, list)) else f"({val_type}, {len(val)} items)"
            print(f"  {key}: {preview}")
