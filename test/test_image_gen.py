#!/usr/bin/env python3
"""
Test runner for Azure FLUX.1-Kontext-pro image generation.

Supports text-to-image and image-to-image with text guidance.

Usage:
  python test/test_image_gen.py generate "a cute cat wearing sunglasses"
  python test/test_image_gen.py edit input.jpg "make the background a beach sunset"
  python test/test_image_gen.py edit input.png "turn this into a watercolor painting" --size 1024x1024
"""

import base64
import json
import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/") + "/openai/deployments/FLUX.1-Kontext-pro/images/generations"
AZURE_API_VERSION = "2025-04-01-preview"
AZURE_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")


def generate_image(prompt, size="1024x1024"):
    """Text-to-image generation using FLUX.1-Kontext-pro."""
    print(f"\n=== FLUX.1-Kontext-pro: text-to-image ===")
    print(f'  Prompt: "{prompt}"')
    print(f"  Size: {size}")

    resp = requests.post(
        AZURE_ENDPOINT,
        params={"api-version": AZURE_API_VERSION},
        headers={
            "api-key": AZURE_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "prompt": prompt,
            "size": size,
            "n": 1,
        },
    )

    print(f"  Status: {resp.status_code}")

    if not resp.ok:
        print(f"  FAILED: {resp.text[:500]}")
        return {"success": False}

    data = resp.json()
    return _save_result(data, "generate")


def edit_image(image_path, prompt, size="1024x1024"):
    """Image-to-image with text guidance using FLUX.1-Kontext-pro."""
    if not os.path.isfile(image_path):
        print(f"File not found: {image_path}")
        sys.exit(1)

    print(f"\n=== FLUX.1-Kontext-pro: image-to-image ===")
    print(f"  Input: {image_path}")
    print(f'  Prompt: "{prompt}"')
    print(f"  Size: {size}")

    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    ext = os.path.splitext(image_path)[1].lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext.lstrip("."), "image/png")
    data_url = f"data:{mime};base64,{image_b64}"

    print(f"  Image size: {len(image_b64)} chars (base64)")

    resp = requests.post(
        AZURE_ENDPOINT,
        params={"api-version": AZURE_API_VERSION},
        headers={
            "api-key": AZURE_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "prompt": prompt,
            "size": size,
            "n": 1,
            "image": data_url,
        },
    )

    print(f"  Status: {resp.status_code}")

    if not resp.ok:
        print(f"  FAILED: {resp.text[:500]}")
        return {"success": False}

    data = resp.json()
    return _save_result(data, "edit")


def _save_result(data, prefix):
    """Save the generated image from the API response."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    images = data.get("data", [])
    if not images:
        print("  No images in response")
        print(f"  Response: {json.dumps(data, indent=2)[:500]}")
        return {"success": False, "data": data}

    saved = []
    for i, img in enumerate(images):
        ts = int(time.time())
        filename = f"{prefix}_{ts}_{i}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)

        if img.get("b64_json"):
            img_bytes = base64.b64decode(img["b64_json"])
            with open(filepath, "wb") as f:
                f.write(img_bytes)
            print(f"  SUCCESS — saved to {filepath}")
            saved.append(filepath)
        elif img.get("url"):
            print(f"  Image URL: {img['url']}")
            # Download the image
            img_resp = requests.get(img["url"])
            if img_resp.ok:
                with open(filepath, "wb") as f:
                    f.write(img_resp.content)
                print(f"  SUCCESS — saved to {filepath}")
                saved.append(filepath)
            else:
                print(f"  Failed to download image from URL")
        else:
            print(f"  Unknown image format in response")
            print(f"  Keys: {list(img.keys())}")

    if img.get("revised_prompt"):
        print(f'  Revised prompt: "{img["revised_prompt"]}"')

    return {"success": len(saved) > 0, "files": saved, "data": data}


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print('  python test/test_image_gen.py generate "prompt"')
        print('  python test/test_image_gen.py edit <image> "prompt" [--size 1024x1024]')
        sys.exit(1)

    command = sys.argv[1]

    # Parse optional --size flag
    size = "1024x1024"
    args = sys.argv[2:]
    if "--size" in args:
        idx = args.index("--size")
        if idx + 1 < len(args):
            size = args[idx + 1]
            args = args[:idx] + args[idx + 2:]

    if command == "generate":
        if not args:
            print('Usage: python test/test_image_gen.py generate "prompt"')
            sys.exit(1)
        generate_image(args[0], size=size)

    elif command == "edit":
        if len(args) < 2:
            print('Usage: python test/test_image_gen.py edit <image> "prompt"')
            sys.exit(1)
        edit_image(args[0], args[1], size=size)

    else:
        print(f"Unknown command: {command}")
        print("Available: generate, edit")
        sys.exit(1)


if __name__ == "__main__":
    main()
