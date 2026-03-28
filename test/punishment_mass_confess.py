#!/usr/bin/env python3
"""
Punishment: Mass Confession (x3)
Sends AI love confessions to 3 random mutuals at once.

Usage: python test/punishment_mass_confess.py
"""

import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
import ssl

from openai import AzureOpenAI
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from config import ACCOUNTS, headers as config_headers
from cache import get_mutuals_cached

ACTIVE = ACCOUNTS[0]
NUM_VICTIMS = 3
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
    is_write = method == "POST"
    min_delay = 3.0 if is_write else 0.5
    elapsed = time.time() - last_call_time
    if elapsed < min_delay:
        time.sleep(min_delay - elapsed)
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


azure_client = AzureOpenAI(
    api_version="2024-12-01-preview",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
)

# -- Fresh GraphQL tokens --

_cached_tokens = None


def get_graphql_tokens():
    global _cached_tokens
    if _cached_tokens:
        return _cached_tokens
    print(f"  {DIM}Scraping fresh GraphQL tokens...{RESET}")
    headers = config_headers()
    req = urllib.request.Request("https://www.instagram.com/", headers=headers)
    resp = urllib.request.urlopen(req, context=ssl_ctx)
    html = resp.read().decode("utf-8", errors="replace")
    dtsg_match = re.search(r'"DTSGInitialData".*?"token":"([^"]+)"', html)
    lsd_match = re.search(r'"LSD".*?"token":"([^"]+)"', html)
    if dtsg_match and lsd_match:
        _cached_tokens = {"fb_dtsg": dtsg_match.group(1), "lsd": lsd_match.group(1)}
        print(f"  {GREEN}Got fresh tokens{RESET}")
        return _cached_tokens
    from config import GRAPHQL_TOKENS
    _cached_tokens = GRAPHQL_TOKENS
    return _cached_tokens


def get_profile_info(username):
    url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}"
    status, data = rate_limited_request(url)
    if status != 200:
        return None
    user = (data.get("data") or {}).get("user")
    if not user:
        return None
    return {
        "fullName": user.get("full_name", ""),
        "bio": user.get("biography", ""),
    }


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
    return resp.choices[0].message.content.strip().strip('"')


def send_dm(recipient_id, text):
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
        "__a": "1", "__user": "0", "__comet_req": "7",
        "fb_api_caller_class": "RelayModern",
        "fb_api_req_friendly_name": "IGDirectTextSendMutation",
        "server_timestamps": "true",
        "variables": json.dumps(variables),
        "doc_id": "25288447354146606",
    }
    status, data = rate_limited_request(
        "https://www.instagram.com/api/graphql",
        method="POST", data=form_data,
        extra_headers={"x-fb-friendly-name": "IGDirectTextSendMutation", "x-fb-lsd": tokens["lsd"]},
    )
    if status != 200 or not isinstance(data, dict) or data.get("raw"):
        return False
    return len(data.get("errors", [])) == 0


def main():
    print(f"\n{BOLD}Punishment: Mass Confession (x{NUM_VICTIMS}){RESET}\n")

    mutuals = get_mutuals_cached(ACTIVE["userId"], rate_limited_request)
    print(f"  {DIM}{len(mutuals)} mutuals loaded{RESET}")

    victims = random.sample(mutuals, min(NUM_VICTIMS, len(mutuals)))
    print(f"  Targets: {', '.join('@' + v['username'] for v in victims)}\n")

    for i, victim in enumerate(victims):
        print(f"  {BOLD}[{i+1}/{NUM_VICTIMS}] @{victim['username']}{RESET}")

        info = get_profile_info(victim["username"])
        bio = (info or {}).get("bio", "")
        full_name = (info or {}).get("fullName") or victim.get("fullName")

        msg = generate_confession(victim["username"], full_name, bio)
        print(f"  {CYAN}\"{msg}\"{RESET}")

        print(f"  Sending...")
        if send_dm(victim["id"], msg):
            print(f"  {GREEN}PASS — sent to @{victim['username']}{RESET}\n")
        else:
            print(f"  {RED}FAIL — DM failed{RESET}\n")

    print()


if __name__ == "__main__":
    main()
