"""
Test runner for Instagram API endpoints.

Usage: python test/test_api.py [test-name]
  python test/test_api.py explore          — fetch explore profiles
  python test/test_api.py profile [user]   — fetch profile info
  python test/test_api.py send-self        — send a DM to yourself via GraphQL
  python test/test_api.py send <id> [msg]  — send a DM to a specific user
  python test/test_api.py simulate [msg]   — fetch following, pick one, send DM
  python test/test_api.py follow <id>      — follow a user
  python test/test_api.py unfollow <id>    — unfollow a user
  python test/test_api.py follow-rt <id>   — follow then unfollow (round-trip)
  python test/test_api.py upload <file>    — upload a photo (no publish)
  python test/test_api.py send-reel <id> <url> [msg] — send a reel via DM to a user
  python test/test_api.py post <file> [caption] — upload + publish a feed post
  python test/test_api.py edit-profile     — update profile (bio, name, username, etc.)
  python test/test_api.py change-pic <file> — change profile picture
  python test/test_api.py comment <media_id> [text] — comment on a post
  python test/test_api.py all              — run all read-only tests
"""

import json
import os
import random
import sys
import time

import requests

# Shared upload helper
def _rupload_params(upload_id):
    """Build X-Instagram-Rupload-Params header value."""
    return json.dumps({
        "retry_context": json.dumps({
            "num_step_auto_retry": 0,
            "num_reupload": 0,
            "num_step_manual_retry": 0,
        }),
        "media_type": 1,
        "upload_id": upload_id,
        "image_compression": json.dumps({
            "lib_name": "moz",
            "lib_version": "3.1.m",
            "quality": "80",
        }),
        "xsharing_user_ids": "[]",
    })

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


def test_upload_photo(file_path):
    """Upload a photo to Instagram's rupload endpoint. Returns the upload_id on success."""
    if not file_path:
        print("Usage: python test/test_api.py upload <file>")
        sys.exit(1)
    if not os.path.isfile(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)

    print(f"\n=== TEST: uploadPhoto({file_path}) ===")

    upload_id = str(int(time.time()))
    photo_data = open(file_path, "rb").read()
    entity_name = f"{upload_id}_0_{random.randint(1000000000, 9999999999)}"

    print(f"  upload_id: {upload_id}")
    print(f"  entity_name: {entity_name}")
    print(f"  file size: {len(photo_data)} bytes")

    upload_headers = {
        **HEADERS,
        "x-instagram-rupload-params": _rupload_params(upload_id),
        "x-entity-name": entity_name,
        "x-entity-length": str(len(photo_data)),
        "x-entity-type": "image/jpeg",
        "content-type": "image/jpeg",
        "offset": "0",
        "sec-fetch-site": "same-site",
    }

    resp = requests.post(
        f"https://i.instagram.com/rupload_igphoto/{entity_name}",
        headers=upload_headers,
        data=photo_data,
    )

    print("Status:", resp.status_code)

    if resp.ok:
        data = resp.json()
        print("SUCCESS — photo uploaded")
        print("  Response:", json.dumps(data, indent=2)[:500])
        return {"success": True, "upload_id": upload_id, "data": data}
    else:
        print("FAILED")
        print("  Response:", resp.text[:500])
        return {"success": False, "upload_id": upload_id}


def test_post_photo(file_path, caption=None):
    """Upload a photo and publish it as a feed post."""
    if not file_path:
        print("Usage: python test/test_api.py post <file> [caption]")
        sys.exit(1)
    caption = caption or ""
    print(f"\n=== TEST: postPhoto({file_path}) ===")
    print(f'  Caption: "{caption}"')

    # Step 1: Upload
    upload_result = test_upload_photo(file_path)
    if not upload_result["success"]:
        print("\nUpload failed — skipping configure")
        return {"success": False}

    upload_id = upload_result["upload_id"]
    print("\n  Waiting 3s before configure...")
    time.sleep(3)

    # Step 2: Configure / publish
    print(f"\n=== Configuring media (upload_id={upload_id}) ===")

    resp = requests.post(
        "https://www.instagram.com/api/v1/media/configure/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data={
            "upload_id": upload_id,
            "caption": caption,
            "source_type": "4",
        },
    )

    print("Status:", resp.status_code)

    if resp.ok:
        data = resp.json()
        media = data.get("media") or {}
        print("SUCCESS — post published")
        print(f"  media_id: {media.get('id')}")
        print(f"  code: {media.get('code')}")
        if media.get("code"):
            print(f"  url: https://www.instagram.com/p/{media['code']}/")
        print("  Response:", json.dumps(data, indent=2)[:500])
        return {"success": True, "data": data}
    else:
        print("FAILED")
        print("  Response:", resp.text[:500])
        return {"success": False}


def test_change_profile_pic(file_path):
    """Change profile picture via multipart upload."""
    if not file_path:
        print("Usage: python test/test_api.py change-pic <file>")
        sys.exit(1)
    if not os.path.isfile(file_path):
        print(f"File not found: {file_path}")
        sys.exit(1)

    print(f"\n=== TEST: changeProfilePicture({file_path}) ===")
    print(f"  file size: {os.path.getsize(file_path)} bytes")

    # Multipart form — don't include content-type in headers, requests sets it with boundary
    upload_headers = {k: v for k, v in HEADERS.items() if k.lower() != "content-type"}

    with open(file_path, "rb") as f:
        resp = requests.post(
            "https://www.instagram.com/api/v1/web/accounts/web_change_profile_picture/",
            headers=upload_headers,
            files={"profile_pic": (os.path.basename(file_path), f, "image/jpeg")},
        )

    print("Status:", resp.status_code)

    if resp.ok:
        data = resp.json()
        print("SUCCESS — profile picture updated")
        print("  Response:", json.dumps(data, indent=2)[:500])
        return {"success": True, "data": data}
    else:
        print("FAILED")
        print("  Response:", resp.text[:500])
        return {"success": False}


def test_edit_profile(fields=None):
    """Edit account profile via /api/v1/web/accounts/edit/.

    Args:
        fields: dict with any of: biography, first_name, username,
                external_url, chaining_enabled, email, phone_number, gender.
    """
    fields = fields or {}
    print("\n=== TEST: editProfile ===")

    # Build payload — only include fields that were provided
    payload = {}
    for key in ("biography", "first_name", "username", "external_url",
                "chaining_enabled", "email", "phone_number", "gender"):
        if key in fields:
            payload[key] = fields[key]

    if not payload:
        print("No fields provided — nothing to update")
        print("Usage: python test/test_api.py edit-profile --bio 'new bio' --name 'Name' --username 'user'")
        return {"success": False}

    print("  Fields to update:")
    for k, v in payload.items():
        print(f"    {k}: {v}")

    resp = requests.post(
        "https://www.instagram.com/api/v1/web/accounts/edit/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data=payload,
    )

    print("Status:", resp.status_code)

    if resp.ok:
        data = resp.json()
        print("SUCCESS — profile updated")
        print("  Response:", json.dumps(data, indent=2)[:500])
        return {"success": True, "data": data}
    else:
        print("FAILED")
        print("  Response:", resp.text[:500])
        return {"success": False}


def resolve_media_id(reel_url_or_shortcode):
    """Resolve a reel URL or shortcode to a media_id.

    Accepts:
      - Full URL: https://www.instagram.com/reels/DWZkVB5gXdx/
      - Shortcode: DWZkVB5gXdx
    """
    shortcode = reel_url_or_shortcode.strip().rstrip("/")
    # Extract shortcode from URL
    for prefix in ("/reel/", "/reels/", "/p/"):
        if prefix in shortcode:
            shortcode = shortcode.split(prefix)[-1].split("/")[0].split("?")[0]
            break

    print(f"  Resolving shortcode: {shortcode}")

    resp = requests.get(
        f"https://www.instagram.com/api/v1/media/{shortcode}/media_id/",
        headers=HEADERS,
    )

    if resp.ok:
        data = resp.json()
        media_id = data.get("media_id")
        print(f"  media_id: {media_id}")
        return media_id

    # Fallback: fetch the post page info
    resp = requests.get(
        f"https://www.instagram.com/api/v1/media/{shortcode}/info/",
        headers=HEADERS,
    )
    if resp.ok:
        data = resp.json()
        items = data.get("items", [])
        if items:
            media_id = str(items[0].get("pk") or items[0].get("id"))
            print(f"  media_id (from info): {media_id}")
            return media_id

    print(f"  Could not resolve media_id for: {shortcode}")
    return None


def test_send_reel(recipient_id, reel_url, text=None):
    """Send a reel to a user via DM with an optional message."""
    if not recipient_id or not reel_url:
        print("Usage: python test/test_api.py send-reel <userId> <reelUrl> [message]")
        sys.exit(1)

    print(f"\n=== TEST: sendReel to {recipient_id} ===")
    print(f"  Reel: {reel_url}")
    if text:
        print(f'  Message: "{text}"')

    media_id = resolve_media_id(reel_url)
    if not media_id:
        print("FAILED — could not resolve media_id")
        return {"success": False}

    # Use the media_share broadcast endpoint
    body = {
        "recipient_users": json.dumps([[str(recipient_id)]]),
        "action": "send_item",
        "media_id": media_id,
        "client_context": str(random.randint(10**18, 10**19 - 1)),
    }
    if text:
        body["text"] = text

    resp = requests.post(
        "https://www.instagram.com/api/v1/direct_v2/threads/broadcast/media_share/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data=body,
    )

    print("Status:", resp.status_code)

    if resp.ok:
        data = resp.json()
        print("SUCCESS — reel sent via DM")
        print("  Response:", json.dumps(data, indent=2)[:500])
        return {"success": True, "data": data}
    else:
        print("FAILED")
        print("  Response:", resp.text[:500])
        return {"success": False}


def test_simulate(message=None):
    """Full pipeline: fetch following → pick a random person → send DM."""
    message = message or "hey, just wanted to say what's good 👋"
    print("\n=== SIMULATE: fetch following → pick target → send DM ===")

    # Step 1: Fetch following list
    print("\n[1/3] Fetching people you follow...")
    resp = requests.get(
        f"https://www.instagram.com/api/v1/friendships/{active['userId']}/following/",
        params={"count": 50, "search_surface": "follow_list_page"},
        headers=HEADERS,
    )
    print("Status:", resp.status_code)

    if not resp.ok:
        print("FAILED to fetch following:", resp.text[:300])
        return

    users = resp.json().get("users", [])
    # Filter to non-private accounts
    candidates = [u for u in users if not u.get("is_private", False)]

    if not candidates:
        print("No public accounts found in your following list")
        return

    print(f"  Found {len(users)} following, {len(candidates)} public")
    for u in candidates[:5]:
        print(f"    @{u['username']} ({u.get('pk') or u.get('pk_id')})")

    # Step 2: Pick a random target
    target = random.choice(candidates)
    target_id = str(target.get("pk") or target.get("pk_id"))
    print(f"\n[2/3] Selected: @{target['username']} ({target_id})")

    # Step 3: Send DM
    print(f"\n[3/3] Sending DM...")
    print(f'  Message: "{message}"')

    confirm = input(f"\n  Send to @{target['username']}? (y/n): ").strip().lower()
    if confirm != "y":
        print("  Aborted.")
        return

    result = test_send_graphql(target_id, message)
    if result["success"]:
        print(f"\n✅ Pipeline complete — DM sent to @{target['username']}")
    else:
        print(f"\n❌ Pipeline failed — DM to @{target['username']} did not go through")


def test_comment(media_id, text=None):
    if not media_id:
        print("Usage: python test/test_api.py comment <media_id> [text]")
        sys.exit(1)
    text = text or "[ShotTaker test] comment works!"
    print(f"\n=== TEST: commentOnPost({media_id}) ===")
    print(f'  comment_text: "{text}"')

    resp = requests.post(
        f"https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data={"comment_text": text},
    )

    print("Status:", resp.status_code)

    if resp.ok:
        data = resp.json()
        print("SUCCESS — comment posted")
        print("  Response:", json.dumps(data, indent=2)[:500])
        return {"success": True, "data": data}
    else:
        print("FAILED")
        print("  Response:", resp.text[:500])
        return {"success": False}


def parse_edit_profile_args(argv):
    """Parse --flag value pairs for edit-profile command."""
    fields = {}
    flag_map = {
        "--bio": "biography",
        "--biography": "biography",
        "--name": "first_name",
        "--first-name": "first_name",
        "--username": "username",
        "--url": "external_url",
        "--external-url": "external_url",
        "--chaining": "chaining_enabled",
        "--email": "email",
        "--phone": "phone_number",
        "--gender": "gender",
    }

    i = 0
    while i < len(argv):
        flag = argv[i]
        if flag in flag_map and i + 1 < len(argv):
            fields[flag_map[flag]] = argv[i + 1]
            i += 2
        else:
            i += 1

    return fields


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
    elif test_name == "edit-profile":
        fields = parse_edit_profile_args(sys.argv[2:])
        test_edit_profile(fields)
    elif test_name == "change-pic":
        test_change_profile_pic(sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "upload":
        test_upload_photo(sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "post":
        test_post_photo(
            sys.argv[2] if len(sys.argv) > 2 else None,
            sys.argv[3] if len(sys.argv) > 3 else None,
        )
    elif test_name == "send-reel":
        if len(sys.argv) < 4:
            print("Usage: python test/test_api.py send-reel <userId> <reelUrl> [message]")
            sys.exit(1)
        test_send_reel(
            sys.argv[2],
            sys.argv[3],
            sys.argv[4] if len(sys.argv) > 4 else None,
        )
    elif test_name == "comment":
        test_comment(
            sys.argv[2] if len(sys.argv) > 2 else None,
            sys.argv[3] if len(sys.argv) > 3 else None,
        )
    elif test_name == "simulate":
        test_simulate(sys.argv[2] if len(sys.argv) > 2 else None)
    elif test_name == "all":
        test_explore()
        time.sleep(3)
        test_profile()
        print("\n(Skipping send/follow tests — run explicitly)")
    else:
        print("Unknown test:", test_name)
        print("Available: explore, profile, send-self, send, send-reel, comment, simulate, follow, unfollow, follow-rt, upload, post, edit-profile, change-pic, all")


if __name__ == "__main__":
    main()
