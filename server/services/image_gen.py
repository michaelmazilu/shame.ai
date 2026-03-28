"""
Image generation via Azure FLUX.1-Kontext-pro.
"""

import base64
import os
import time

import requests

from server.config import get_settings

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "output")


def _get_endpoint():
    settings = get_settings()
    return settings.azure_openai_endpoint.rstrip("/") + "/openai/deployments/FLUX.1-Kontext-pro/images/generations"


def generate_image(prompt, size="1024x1024"):
    """Text-to-image generation."""
    settings = get_settings()
    resp = requests.post(
        _get_endpoint(),
        params={"api-version": "2025-04-01-preview"},
        headers={"api-key": settings.azure_openai_api_key, "Content-Type": "application/json"},
        json={"prompt": prompt, "size": size, "n": 1},
    )
    if not resp.ok:
        return {"success": False, "error": resp.text[:500]}
    return _process_result(resp.json(), "generate")


def edit_image(image_b64, prompt, mime_type="image/png", size="1024x1024"):
    """Image-to-image with text guidance. Accepts base64-encoded image."""
    settings = get_settings()
    data_url = f"data:{mime_type};base64,{image_b64}"

    resp = requests.post(
        _get_endpoint(),
        params={"api-version": "2025-04-01-preview"},
        headers={"api-key": settings.azure_openai_api_key, "Content-Type": "application/json"},
        json={"prompt": prompt, "size": size, "n": 1, "image": data_url},
    )
    if not resp.ok:
        return {"success": False, "error": resp.text[:500]}
    return _process_result(resp.json(), "edit")


def _process_result(data, prefix):
    """Extract image bytes/URL from API response."""
    images = data.get("data", [])
    if not images:
        return {"success": False, "error": "No images in response"}

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    saved = []

    for i, img in enumerate(images):
        ts = int(time.time())
        filename = f"{prefix}_{ts}_{i}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)

        if img.get("b64_json"):
            img_bytes = base64.b64decode(img["b64_json"])
            with open(filepath, "wb") as f:
                f.write(img_bytes)
            saved.append({"path": filepath, "b64": img["b64_json"]})
        elif img.get("url"):
            img_resp = requests.get(img["url"])
            if img_resp.ok:
                with open(filepath, "wb") as f:
                    f.write(img_resp.content)
                saved.append({"path": filepath, "url": img["url"]})

    return {
        "success": len(saved) > 0,
        "images": saved,
        "revised_prompt": images[0].get("revised_prompt") if images else None,
    }
