#!/usr/bin/env python3
"""
Punishment: Embarrassing Bio Change
AI generates a cringe bio and sets it as YOUR Instagram bio.

Usage: python test/punishment_bio.py
"""

import json
import os
import re
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


def get_current_bio(username):
    url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}"
    status, data = rate_limited_request(url)
    if status != 200:
        return None
    user = (data.get("data") or {}).get("user")
    return user.get("biography", "") if user else None


def generate_embarrassing_bio(current_bio=None, username=None):
    context = ""
    if username:
        context += f"The account is @{username}. "
    if current_bio:
        context += f'Their current bio is: "{current_bio}". '

    resp = azure_client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write embarrassing Instagram bios as a dare/punishment. "
                    "Keep it to 1-2 lines max. Be funny and cringe but not offensive. "
                    "Think: over-the-top self-deprecation, weird flex, absurd confession. "
                    "No slurs, no bullying, just comedy. No hashtags."
                ),
            },
            {"role": "user", "content": f"Write an embarrassing Instagram bio. {context}"},
        ],
        max_tokens=80,
        temperature=1.0,
    )
    return resp.choices[0].message.content.strip().strip('"')


def edit_bio(new_bio):
    headers = {**config_headers(), "content-type": "application/x-www-form-urlencoded"}
    resp = requests.post(
        "https://www.instagram.com/api/v1/web/accounts/edit/",
        headers=headers,
        data={"biography": new_bio},
    )
    return resp.ok


def main():
    print(f"\n{BOLD}Punishment: Embarrassing Bio Change{RESET}\n")

    # Get current bio
    username = ACTIVE.get("name", "")
    # We don't know the username from config, so fetch from mutuals context
    mutuals = get_mutuals_cached(ACTIVE["userId"], rate_limited_request)
    print(f"  {DIM}Loaded {len(mutuals)} mutuals{RESET}")

    print(f"  {DIM}Fetching current bio...{RESET}")
    # Try to get our own username from the session
    status, data = rate_limited_request("https://www.instagram.com/api/v1/accounts/edit/web_form_data/")
    current_bio = ""
    our_username = ""
    if status == 200 and isinstance(data, dict):
        form_data = data.get("form_data", data)
        current_bio = form_data.get("biography", "")
        our_username = form_data.get("username", "")

    print(f"  Current bio: {DIM}\"{current_bio}\"{RESET}")

    # Generate embarrassing bio
    print(f"  {DIM}Generating embarrassing bio...{RESET}")
    new_bio = generate_embarrassing_bio(current_bio, our_username)
    print(f"  New bio: {CYAN}\"{new_bio}\"{RESET}")

    # Set it
    print(f"  Setting bio...")
    if edit_bio(new_bio):
        print(f"  {GREEN}PASS — bio changed!{RESET}")
    else:
        print(f"  {RED}FAIL — could not change bio{RESET}")

    print()


if __name__ == "__main__":
    main()
