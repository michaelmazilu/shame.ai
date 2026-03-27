"""
Test runner for Instagram API endpoints.

Usage: python test/test_api.py [test-name]
  python test/test_api.py explore          — fetch explore profiles
  python test/test_api.py profile [user]   — fetch profile info
  python test/test_api.py send-self        — send a DM to yourself via GraphQL
  python test/test_api.py send <id> [msg]  — send a DM to a specific user
  python test/test_api.py follow <id>      — follow a user
  python test/test_api.py unfollow <id>    — unfollow a user
  python test/test_api.py follow-rt <id>   — follow then unfollow (round-trip)
  python test/test_api.py all              — run all read-only tests
"""

import json
import random
import sys
import time

import requests

from config import active, headers, GRAPHQL_TOKENS

HEADERS = headers()


def test_explore():
    print("\n=== TEST: getExploreProfiles ===")
    resp = requests.get(
        "https://www.instagram.com/api/v1/discover/topical_explore/",
        headers=HEADERS,
    )
    print("Status:", resp.status_code)

    if not resp.ok:
        print("Body:", resp.text[:300])
        return None

    data = resp.json()
    users = []
    items = data.get("sectional_items") or data.get("items") or []
    for section in items:
        media_items = (section.get("layout_content") or {}).get("medias") or []
        for media in media_items:
            u = (media.get("media") or {}).get("user")
            if u:
                uid = u.get("pk") or u.get("pk_id")
                if uid and not any(e["id"] == uid for e in users):
                    users.append({
                        "id": uid,
                        "username": u.get("username"),
                        "fullName": u.get("full_name"),
                    })

    print(f"Found {len(users)} explore profiles")
    for u in users[:5]:
        print(f"  @{u['username']} ({u['id']}) — {u['fullName']}")
    return users


def test_profile(username=None):
    username = username or "instagram"
    print(f"\n=== TEST: getProfileInfo(@{username}) ===")
    resp = requests.get(
        "https://www.instagram.com/api/v1/users/web_profile_info/",
        params={"username": username},
        headers=HEADERS,
    )
    print("Status:", resp.status_code)

    if not resp.ok:
        print("Body:", resp.text[:300])
        return None

    data = resp.json()
    user = (data.get("data") or {}).get("user")
    if not user:
        print("No user data in response")
        return None

    profile = {
        "id": user.get("id"),
        "username": user.get("username"),
        "fullName": user.get("full_name"),
        "bio": (user.get("biography") or "")[:80],
        "followers": (user.get("edge_followed_by") or {}).get("count"),
        "following": (user.get("edge_follow") or {}).get("count"),
        "isPrivate": user.get("is_private"),
    }

    print(f"  ID: {profile['id']}")
    print(f"  Name: {profile['fullName']}")
    print(f"  Bio: {profile['bio']}")
    print(f"  Followers: {profile['followers']} | Following: {profile['following']}")
    print(f"  Private: {profile['isPrivate']}")
    return profile


def test_send_graphql(recipient_id=None, text=None):
    recipient_id = recipient_id or active["userId"]
    text = text or "[ShotTaker test] GraphQL DM works!"
    print(f"\n=== TEST: sendDMGraphQL to {recipient_id} ===")
    print(f'  Message: "{text}"')

    offline_threading_id = str(random.randint(10**18, 10**19 - 1))

    variables = {
        "ig_thread_igid": None,
        "offline_threading_id": offline_threading_id,
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

    body = {
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

    send_headers = {
        **HEADERS,
        "content-type": "application/x-www-form-urlencoded",
        "x-fb-friendly-name": "IGDirectTextSendMutation",
        "x-fb-lsd": GRAPHQL_TOKENS["lsd"],
    }

    resp = requests.post(
        "https://www.instagram.com/api/graphql",
        headers=send_headers,
        data=body,
    )

    print("Status:", resp.status_code)
    data = resp.json()

    if resp.ok and not data.get("errors"):
        print("SUCCESS — DM sent via GraphQL")
        print("Response:", json.dumps(data, indent=2)[:500])
    else:
        print("FAILED")
        print("Errors:", json.dumps(data.get("errors") or data, indent=2)[:1000])

    return {"success": resp.ok and not data.get("errors"), "data": data}


def test_follow(user_id):
    if not user_id:
        print("Usage: python test/test_api.py follow <userId>")
        sys.exit(1)
    print(f"\n=== TEST: followUser({user_id}) ===")

    resp = requests.post(
        f"https://www.instagram.com/api/v1/friendships/create/{user_id}/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data={"container_module": "profile", "user_id": user_id},
    )

    print("Status:", resp.status_code)
    data = resp.json()

    if resp.ok:
        print("SUCCESS — followed user")
        print("  friendship_status:", json.dumps(data.get("friendship_status") or data.get("result"), indent=2))
    else:
        print("FAILED")
        print("  Response:", json.dumps(data, indent=2)[:500])

    return {"success": resp.ok, "data": data}


def test_unfollow(user_id):
    if not user_id:
        print("Usage: python test/test_api.py unfollow <userId>")
        sys.exit(1)
    print(f"\n=== TEST: unfollowUser({user_id}) ===")

    resp = requests.post(
        f"https://www.instagram.com/api/v1/friendships/destroy/{user_id}/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data={"container_module": "profile", "user_id": user_id},
    )

    print("Status:", resp.status_code)
    data = resp.json()

    if resp.ok:
        print("SUCCESS — unfollowed user")
        print("  friendship_status:", json.dumps(data.get("friendship_status") or data.get("result"), indent=2))
    else:
        print("FAILED")
        print("  Response:", json.dumps(data, indent=2)[:500])

    return {"success": resp.ok, "data": data}


def test_follow_round_trip(user_id):
    if not user_id:
        print("Usage: python test/test_api.py follow-rt <userId>")
        sys.exit(1)
    print(f"\n=== TEST: follow → unfollow round-trip ({user_id}) ===")

    result = test_follow(user_id)
    if not result["success"]:
        print("\nFollow failed — skipping unfollow")
        return

    print("\n  Waiting 5s before unfollow...")
    time.sleep(5)

    test_unfollow(user_id)
    print("\nRound-trip complete")


def main():
    test_name = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"Using account: {active['name']} ({active['userId']})")

    if test_name == "explore":
        test_explore()
    elif test_name == "profile":
        test_profile(sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "send-self":
        test_send_graphql(active["userId"], sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "send":
        if len(sys.argv) < 3:
            print("Usage: python test/test_api.py send <userId> [message]")
            sys.exit(1)
        test_send_graphql(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    elif test_name == "follow":
        test_follow(sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "unfollow":
        test_unfollow(sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "follow-rt":
        test_follow_round_trip(sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "all":
        test_explore()
        time.sleep(3)
        test_profile()
        print("\n(Skipping send/follow tests — run explicitly)")
    else:
        print("Unknown test:", test_name)
        print("Available: explore, profile, send-self, send, follow, unfollow, follow-rt, all")


if __name__ == "__main__":
    main()
