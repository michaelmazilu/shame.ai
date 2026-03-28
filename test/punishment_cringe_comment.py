#!/usr/bin/env python3
"""
Punishment: Cringe Comment on Victim's Post
Finds the victim's latest post and leaves an obsessed-fan-level comment.

Usage: python test/punishment_cringe_comment.py
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import ssl

import requests
from openai import AzureOpenAI
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from config import ACCOUNTS, headers as config_headers
from cache import get_mutuals_cached

ACTIVE = ACCOUNTS[0]
VICTIM_IDX = 0
BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"

ssl_ctx = ssl.create_default_context()
last_call_time = 0


def rate_limited_request(url, method="GET", data=None, extra_headers=None):
    global last_call_time
    elapsed = time.time() - last_call_time
    if elapsed < 0.5:
        time.sleep(0.5 - elapsed)
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
        body = json.loads(raw) if raw.strip() else {}
        return resp.status, body
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()[:500]
        try:
            body = json.loads(body_text)
        except Exception:
            body = body_text
        return e.code, body


azure_client = AzureOpenAI(
    api_version="2024-12-01-preview",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
)


def get_latest_post(user_id):
    status, data = rate_limited_request(
        f"https://www.instagram.com/api/v1/feed/user/{user_id}/?count=1"
    )
    if status == 200 and data.get("items"):
        item = data["items"][0]
        return {
            "media_id": str(item.get("pk") or item.get("id")),
            "caption": (item.get("caption") or {}).get("text", ""),
        }
    return None


def generate_cringe_comment(username, caption=None):
    context = f"The post is by @{username}. "
    if caption:
        context += f'Caption: "{caption[:150]}". '

    resp = azure_client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write embarrassing Instagram comments as a dare. "
                    "The comment should look like an overly obsessed fan or an embarrassing friend. "
                    "Keep it to 1-2 sentences. Be funny and cringe. "
                    "No slurs or bullying, just comedy. No hashtags. 0-1 emojis max."
                ),
            },
            {"role": "user", "content": f"Write an embarrassing comment. {context}"},
        ],
        max_tokens=60,
        temperature=1.0,
    )
    return resp.choices[0].message.content.strip().strip('"')


def comment_on_post(media_id, text):
    headers = {**config_headers(), "content-type": "application/x-www-form-urlencoded"}
    resp = requests.post(
        f"https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
        headers=headers,
        data={"comment_text": text},
    )
    return resp.ok


def main():
    print(f"\n{BOLD}Punishment: Cringe Comment on Victim's Post{RESET}\n")

    mutuals = get_mutuals_cached(ACTIVE["userId"], rate_limited_request)
    victim = mutuals[VICTIM_IDX]
    print(f"  Victim: {BOLD}@{victim['username']}{RESET}  {DIM}{victim.get('fullName', '')}{RESET}")

    print(f"  {DIM}Fetching their latest post...{RESET}")
    post = get_latest_post(victim["id"])
    if not post:
        print(f"  {RED}FAIL — no posts found (might be private or no posts){RESET}")
        return

    print(f"  Media ID: {post['media_id']}")
    if post["caption"]:
        print(f"  Caption: {DIM}\"{post['caption'][:80]}\"{RESET}")

    print(f"  {DIM}Generating cringe comment...{RESET}")
    comment = generate_cringe_comment(victim["username"], post["caption"])
    print(f"  Comment: {CYAN}\"{comment}\"{RESET}")

    print(f"  Posting...")
    if comment_on_post(post["media_id"], comment):
        print(f"  {GREEN}PASS — cringe comment posted on @{victim['username']}'s post!{RESET}")
    else:
        print(f"  {RED}FAIL — could not post comment{RESET}")

    print()


if __name__ == "__main__":
    main()
