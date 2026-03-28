"""
Test editing Instagram profile fields (bio, name, username, url).

The /accounts/edit/ endpoint requires ALL fields to be sent — if you omit one,
it gets blanked. So we first fetch the current profile to get defaults, then
merge in whatever you want to change.

Usage:
  python test/test_edit_profile.py                          — read current profile, update bio as test
  python test/test_edit_profile.py --bio "new bio"          — set bio
  python test/test_edit_profile.py --name "Name"            — set display name
  python test/test_edit_profile.py --username "newuser"     — set username
  python test/test_edit_profile.py --url "https://..."      — set external url
  python test/test_edit_profile.py --bio "a" --name "b"     — set multiple fields

WARNING: This will actually change your profile!
"""

import json
import sys

import requests

from config import active, headers

HEADERS = headers()

FLAG_MAP = {
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


def get_current_profile():
    """Fetch current profile to use as defaults (endpoint requires all fields)."""
    print("Fetching current profile...")
    resp = requests.get(
        "https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
        headers=HEADERS,
    )
    if resp.ok:
        data = resp.json()
        form_data = data.get("form_data") or {}
        print(f"  username: {form_data.get('username')}")
        print(f"  first_name: {form_data.get('first_name')}")
        print(f"  biography: {form_data.get('biography')}")
        print(f"  external_url: {form_data.get('external_url')}")
        print(f"  email: {form_data.get('email')}")
        print(f"  phone_number: {form_data.get('phone_number')}")
        return form_data
    else:
        print(f"  Failed ({resp.status_code}) — will send only the fields you specified")
        print(f"  {resp.text[:300]}")
        return None


def test_edit_profile(overrides):
    print(f"Using account: {active['name']} ({active['userId']})\n")

    # Fetch current values so we don't blank out fields
    current = get_current_profile()

    if not overrides:
        # Default: flip bio to prove it works
        overrides = {"biography": f"[ShotTaker test] updated at {__import__('time').strftime('%H:%M:%S')}"}
        print("\nNo flags provided — defaulting to bio update test")

    # Build full payload: current profile + overrides
    if current:
        payload = {
            "biography": current.get("biography", ""),
            "chaining_enabled": "on",
            "external_url": current.get("external_url", ""),
            "first_name": current.get("first_name", ""),
            "username": current.get("username", ""),
        }
        # Include email/phone if present
        if current.get("email"):
            payload["email"] = current["email"]
        if current.get("phone_number"):
            payload["phone_number"] = current["phone_number"]
    else:
        payload = {}

    # Apply overrides
    payload.update(overrides)

    print("\n--- Fields being sent ---")
    for k, v in payload.items():
        changed = k in overrides
        print(f"  {k}: {v}{'  ← CHANGED' if changed else ''}")

    print("\n--- Sending POST to /api/v1/web/accounts/edit/ ---")

    resp = requests.post(
        "https://www.instagram.com/api/v1/web/accounts/edit/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data=payload,
    )

    print(f"Status: {resp.status_code}")

    if resp.ok:
        data = resp.json()
        print("SUCCESS — profile updated!")
        print(f"\nResponse:\n{json.dumps(data, indent=2)[:800]}")
    else:
        print("FAILED")
        print(resp.text[:500])


def parse_args(argv):
    fields = {}
    i = 0
    while i < len(argv):
        flag = argv[i]
        if flag in FLAG_MAP and i + 1 < len(argv):
            fields[FLAG_MAP[flag]] = argv[i + 1]
            i += 2
        else:
            i += 1
    return fields


if __name__ == "__main__":
    fields = parse_args(sys.argv[1:])
    test_edit_profile(fields)
