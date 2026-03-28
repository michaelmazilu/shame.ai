"""
Test commenting on an Instagram post.

Usage:
  python test/test_comment.py <media_id> [comment_text]

Example:
  python test/test_comment.py 3862919834665674892 "nice post!"

WARNING: This will actually post a comment!
"""

import json
import sys

import requests

from config import active, headers

HEADERS = headers()


def test_comment(media_id, text=None):
    text = text or "[ShotTaker test] comment works!"
    print(f"Using account: {active['name']} ({active['userId']})")
    print(f"\n=== TEST: commentOnPost({media_id}) ===")
    print(f'  comment_text: "{text}"')

    resp = requests.post(
        f"https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data={"comment_text": text},
    )

    print(f"\nStatus: {resp.status_code}")

    if resp.ok:
        data = resp.json()
        print("SUCCESS — comment posted!")
        print(f"\nResponse:\n{json.dumps(data, indent=2)[:800]}")
        return {"success": True, "data": data}
    else:
        print("FAILED")
        print(resp.text[:500])
        return {"success": False}


DEFAULT_MEDIA_ID = "3862919834665674892"  # noise post from test run
DEFAULT_TEXT = "api test comment"

if __name__ == "__main__":
    test_comment(
        sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MEDIA_ID,
        sys.argv[2] if len(sys.argv) > 2 else DEFAULT_TEXT,
    )
