#!/usr/bin/env python3
"""
Test Azure Sora-2 video generation (image+text → video).

Usage:
  python test/test_video_gen.py "a cat dancing on a rainbow"
  python test/test_video_gen.py input.jpg "make this person dance"
"""

import base64
import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

AZURE_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "").rstrip("/") + "/openai/deployments/sora/videos/generations"
AZURE_API_VERSION = "2025-04-01-preview"
AZURE_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")


def submit_job(prompt, image_path=None, duration=5):
    """Submit a video generation job."""
    print(f"\n=== Sora-2: video generation ===")
    print(f'  Prompt: "{prompt}"')

    body = {
        "prompt": prompt,
        "n": 1,
        "size": "1080x1920",
        "duration": duration,
    }

    if image_path:
        print(f"  Input image: {image_path}")
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")
        ext = os.path.splitext(image_path)[1].lower().lstrip(".")
        mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/png")
        body["image"] = f"data:{mime};base64,{image_b64}"
        print(f"  Image size: {len(image_b64)} chars (base64)")

    resp = requests.post(
        AZURE_ENDPOINT,
        params={"api-version": AZURE_API_VERSION},
        headers={"api-key": AZURE_API_KEY, "Content-Type": "application/json"},
        json=body,
    )

    print(f"  Status: {resp.status_code}")

    if resp.status_code == 202:
        data = resp.json() if resp.text else {}
        job_id = data.get("id") or resp.headers.get("operation-location", "").split("/")[-1].split("?")[0]
        print(f"  Job ID: {job_id}")
        return job_id

    if resp.ok:
        data = resp.json()
        job_id = data.get("id", "")
        print(f"  Job ID: {job_id}")
        return job_id

    print(f"  FAILED: {resp.text[:500]}")
    return None


def poll_job(job_id, max_wait=300):
    """Poll until the video is ready."""
    print(f"\n=== Polling job {job_id} ===")
    start = time.time()

    while time.time() - start < max_wait:
        resp = requests.get(
            f"{AZURE_ENDPOINT}/{job_id}",
            params={"api-version": AZURE_API_VERSION},
            headers={"api-key": AZURE_API_KEY},
        )

        if not resp.ok:
            print(f"  Poll error: {resp.status_code} {resp.text[:200]}")
            time.sleep(5)
            continue

        data = resp.json()
        status = data.get("status", "unknown")
        elapsed = int(time.time() - start)
        print(f"  [{elapsed}s] Status: {status}")

        if status == "succeeded":
            generations = data.get("data", data.get("generations", []))
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            for i, gen in enumerate(generations):
                video_url = gen.get("url") or gen.get("video", {}).get("url")
                if video_url:
                    print(f"  Video URL: {video_url}")
                    video_resp = requests.get(video_url)
                    if video_resp.ok:
                        ts = int(time.time())
                        filepath = os.path.join(OUTPUT_DIR, f"video_{ts}_{i}.mp4")
                        with open(filepath, "wb") as f:
                            f.write(video_resp.content)
                        print(f"  SUCCESS — saved to {filepath}")
            return True

        if status == "failed":
            error = data.get("error", {}).get("message", "Unknown error")
            print(f"  FAILED: {error}")
            return False

        time.sleep(10)

    print(f"  Timed out after {max_wait}s")
    return False


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print('  python test/test_video_gen.py "prompt"')
        print('  python test/test_video_gen.py <image> "prompt"')
        sys.exit(1)

    # Determine if first arg is an image file or a prompt
    if os.path.isfile(sys.argv[1]):
        image_path = sys.argv[1]
        prompt = sys.argv[2] if len(sys.argv) > 2 else "Animate this image"
    else:
        image_path = None
        prompt = sys.argv[1]

    job_id = submit_job(prompt, image_path)
    if job_id:
        poll_job(job_id)


if __name__ == "__main__":
    main()
