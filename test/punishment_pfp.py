#!/usr/bin/env python3
"""
Punishment: AI Profile Pic Swap
AI generates an embarrassing image and sets it as YOUR profile picture.

Usage: python test/punishment_pfp.py
"""

import base64
import io
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

ACTIVE = ACCOUNTS[0]
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"

azure_client = AzureOpenAI(
    api_version="2024-12-01-preview",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
)

AZURE_IMG_ENDPOINT = os.environ["AZURE_OPENAI_ENDPOINT"].rstrip("/") + "/openai/deployments/FLUX.1-Kontext-pro/images/generations"
AZURE_IMG_API_KEY = os.environ["AZURE_OPENAI_API_KEY"]


def generate_pfp_prompt():
    resp = azure_client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You generate image prompts for embarrassing profile pictures as a dare. "
                    "The image should be funny and absurd — NOT a real person's face. "
                    "Think: a potato with googly eyes, a badly drawn MS Paint portrait, "
                    "a cat in a business suit, a stock photo cliché, a cursed image. "
                    "Keep the prompt under 20 words. Just the image description, no quotes."
                ),
            },
            {"role": "user", "content": "Generate an embarrassing profile picture prompt."},
        ],
        max_tokens=40,
        temperature=1.0,
    )
    return resp.choices[0].message.content.strip()


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
        return None, None
    data = resp.json()
    images = data.get("data", [])
    if not images:
        return None, None

    img = images[0]
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, f"pfp_{int(time.time())}.png")

    if img.get("b64_json"):
        img_bytes = base64.b64decode(img["b64_json"])
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        return filepath, img_bytes
    elif img.get("url"):
        img_resp = requests.get(img["url"])
        if img_resp.ok:
            with open(filepath, "wb") as f:
                f.write(img_resp.content)
            return filepath, img_resp.content
    return None, None


def change_profile_picture(image_bytes):
    headers = config_headers()
    resp = requests.post(
        "https://www.instagram.com/api/v1/web/accounts/web_change_profile_picture/",
        headers=headers,
        files={"profile_pic": ("profile_pic.jpg", io.BytesIO(image_bytes), "image/jpeg")},
    )
    return resp.ok


def main():
    print(f"\n{BOLD}Punishment: AI Profile Pic Swap{RESET}\n")

    print(f"  {DIM}Generating embarrassing image prompt...{RESET}")
    prompt = generate_pfp_prompt()
    print(f"  Prompt: {CYAN}\"{prompt}\"{RESET}")

    filepath, img_bytes = generate_image(prompt)
    if not filepath:
        print(f"  {RED}FAIL — image generation failed{RESET}")
        return

    print(f"  {GREEN}Saved: {filepath}{RESET}")
    print(f"  Setting as profile picture...")

    if change_profile_picture(img_bytes):
        print(f"  {GREEN}PASS — profile picture changed!{RESET}")
    else:
        print(f"  {RED}FAIL — could not change pfp{RESET}")

    print()


if __name__ == "__main__":
    main()
