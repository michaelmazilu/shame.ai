#!/usr/bin/env python3
"""
Test commenting on a random public reel.

Discovers reels from trending/explore, picks one at random,
generates an AI comment, and posts it.

Usage:
  python test/test_reel_comment.py                    # AI-generated comment
  python test/test_reel_comment.py "fire content"     # custom comment
  python test/test_reel_comment.py --source explore   # use explore instead of trending
"""

import json
import os
import random
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import headers
from ig_auth import get_client

import requests
from openai import AzureOpenAI

HEADERS = headers()


def fetch_random_reel(source="trending"):
    """Fetch reels and pick a random one."""
    print(f"\n=== Fetching reels ({source}) ===")
    cl = get_client()

    if source == "explore":
        medias = cl.explore_page(amount=20)
    else:
        medias = cl.clips(amount=10)

    reels = [m for m in medias if m.media_type == 2 and m.product_type == "clips"]

    if not reels:
        print("  No reels found")
        return None

    reel = random.choice(reels)
    user = reel.user.username if reel.user else "unknown"
    caption = (reel.caption_text or "")[:80]
    print(f"  Found {len(reels)} reels")
    print(f"  Selected: @{user} — {caption}")
    print(f"  Media ID: {reel.pk}")
    print(f"  Views: {reel.view_count or 0:,} | Likes: {reel.like_count or 0:,}")

    return {
        "media_id": str(reel.pk),
        "username": user,
        "caption": reel.caption_text or "",
    }


def generate_comment(caption=None, username=None):
    """Generate a comment using Azure OpenAI."""
    print("\n=== Generating AI comment ===")

    client = AzureOpenAI(
        api_version="2024-12-01-preview",
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
    )

    context_parts = []
    if username:
        context_parts.append(f"The reel is by @{username}.")
    if caption:
        context_parts.append(f'The caption is: "{caption[:200]}"')
    context = " ".join(context_parts) if context_parts else "A random Instagram reel."

    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write short, funny Instagram comments on reels. "
                    "Keep it to 1 sentence max. Be witty, relatable, or hype. "
                    "Sound like a real person, not a bot. No hashtags. "
                    "Don't use emojis excessively (0-1 max)."
                ),
            },
            {
                "role": "user",
                "content": f"Write a comment for this reel. {context}",
            },
        ],
        max_tokens=60,
        temperature=0.9,
    )
    text = resp.choices[0].message.content.strip()
    print(f'  Comment: "{text}"')
    return text


def post_comment(media_id, text):
    """Post a comment on a reel."""
    print(f"\n=== Posting comment on {media_id} ===")
    print(f'  Text: "{text}"')

    resp = requests.post(
        f"https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data={"comment_text": text},
    )

    print(f"  Status: {resp.status_code}")

    if resp.ok:
        data = resp.json()
        print("  SUCCESS — comment posted!")
        print(f"  Response: {json.dumps(data, indent=2)[:400]}")
        return True
    else:
        print(f"  FAILED: {resp.text[:500]}")
        return False


def main():
    # Parse args
    custom_text = None
    source = "trending"

    args = sys.argv[1:]
    if "--source" in args:
        idx = args.index("--source")
        if idx + 1 < len(args):
            source = args[idx + 1]
            args = args[:idx] + args[idx + 2:]

    if args and not args[0].startswith("--"):
        custom_text = args[0]

    # Find a random reel
    reel = fetch_random_reel(source=source)
    if not reel:
        print("No reels found. Try again.")
        sys.exit(1)

    # Get comment text
    if custom_text:
        text = custom_text
        print(f'\n  Using custom comment: "{text}"')
    else:
        text = generate_comment(caption=reel["caption"], username=reel["username"])

    # Post it
    post_comment(reel["media_id"], text)


if __name__ == "__main__":
    main()
