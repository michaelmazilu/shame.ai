#!/usr/bin/env python3
"""
Punishment: Thirst Trap Story
AI generates a dramatic "I miss you @victim" image and posts it as your story.

Usage: python test/punishment_thirst_story.py
"""

import base64
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
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
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


AZURE_IMG_ENDPOINT = os.environ["AZURE_OPENAI_ENDPOINT"].rstrip("/") + "/openai/deployments/FLUX.1-Kontext-pro/images/generations"
AZURE_IMG_API_KEY = os.environ["AZURE_OPENAI_API_KEY"]


def generate_image(prompt):
    print(f"  {DIM}Generating image...{RESET}")
    resp = requests.post(
        AZURE_IMG_ENDPOINT,
        params={"api-version": "2025-04-01-preview"},
        headers={"api-key": AZURE_IMG_API_KEY, "Content-Type": "application/json"},
        json={"prompt": prompt, "size": "1024x1024", "n": 1},
    )
    if not resp.ok:
        print(f"  {RED}Image gen failed: {resp.status_code}{RESET}")
        return None
    data = resp.json()
    images = data.get("data", [])
    if not images:
        return None

    img = images[0]
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, f"thirst_{int(time.time())}.png")

    if img.get("b64_json"):
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(img["b64_json"]))
        return filepath
    elif img.get("url"):
        img_resp = requests.get(img["url"])
        if img_resp.ok:
            with open(filepath, "wb") as f:
                f.write(img_resp.content)
            return filepath
    return None


def upload_story(filepath, caption=""):
    from ig_auth import get_client
    print(f"  {DIM}Logging in via instagrapi...{RESET}")
    cl = get_client()
    result = cl.photo_upload_to_story(filepath, caption)
    return result


def main():
    print(f"\n{BOLD}Punishment: Thirst Trap Story{RESET}\n")

    mutuals = get_mutuals_cached(ACTIVE["userId"], rate_limited_request)
    victim = mutuals[VICTIM_IDX]
    name = victim.get("fullName") or victim["username"]
    print(f"  Victim: {BOLD}@{victim['username']}{RESET}  {DIM}{name}{RESET}")

    prompt = (
        f"Aesthetic sad Instagram story image with dramatic lighting, "
        f"rainy window, city lights at night, with large stylized text overlay "
        f"that says 'I miss you' in a handwritten font, melancholic vibes, "
        f"lo-fi aesthetic, soft purple and blue tones"
    )
    print(f"  Prompt: {CYAN}\"{prompt[:80]}...\"{RESET}")

    filepath = generate_image(prompt)
    if not filepath:
        print(f"  {RED}FAIL — image generation failed{RESET}")
        return

    print(f"  {GREEN}Saved: {filepath}{RESET}")

    caption = f"i miss you @{victim['username']} 💔"
    print(f"  Caption: \"{caption}\"")
    print(f"  Uploading to story...")

    try:
        result = upload_story(filepath, caption)
        print(f"  {GREEN}PASS — thirst trap story posted! Media ID: {result.id}{RESET}")
    except Exception as e:
        print(f"  {RED}FAIL — {e}{RESET}")

    print()


if __name__ == "__main__":
    main()
