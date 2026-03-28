"""
Test photo upload to Instagram's rupload endpoint.

Generates a random 200x200 JPEG in memory and attempts to upload it.

Usage: python test/test_upload.py
"""

import io
import json
import struct
import time
import zlib
import random

import requests

from config import active, headers

HEADERS = headers()


def make_random_jpeg(width=200, height=200):
    """Generate a minimal valid JPEG with random-ish pixels (no dependencies).

    Creates a simple baseline JPEG: SOI, APP0 (JFIF), DQT, SOF0, DHT, SOS,
    and compressed scan data. Uses a single 8x8 MCU tiled approach.
    Since building a real JPEG encoder from scratch is complex, we use a
    trick: create a minimal valid BMP in memory, then convert to JPEG
    using Python's built-in tools — but since Pillow may not be available,
    we'll try Pillow first, then fall back to a pre-built tiny JPEG with
    random pixels baked in.
    """
    try:
        from PIL import Image
        img = Image.new("RGB", (width, height))
        pixels = img.load()
        for y in range(height):
            for x in range(width):
                pixels[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        return buf.getvalue()
    except ImportError:
        pass

    # Fallback: generate a PNG and convert via subprocess (macOS sips)
    import subprocess
    import tempfile
    import os

    png_data = _make_png(width, height)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(png_data)
        png_path = f.name
    jpeg_path = png_path.replace(".png", ".jpg")

    try:
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "80", png_path, "--out", jpeg_path],
            capture_output=True, check=True,
        )
        with open(jpeg_path, "rb") as f:
            return f.read()
    finally:
        os.unlink(png_path)
        if os.path.exists(jpeg_path):
            os.unlink(jpeg_path)


def _make_png(width, height):
    """Generate a minimal valid PNG (helper for JPEG fallback)."""
    raw = b""
    for _ in range(height):
        raw += b"\x00"
        for _ in range(width):
            raw += bytes([random.randint(0, 255) for _ in range(3)])

    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    idat_data = zlib.compress(raw)

    png = b"\x89PNG\r\n\x1a\n"
    png += png_chunk(b"IHDR", ihdr_data)
    png += png_chunk(b"IDAT", idat_data)
    png += png_chunk(b"IEND", b"")
    return png


def test_upload():
    print(f"Using account: {active['name']} ({active['userId']})")

    # Generate random JPEG
    jpeg_data = make_random_jpeg()
    print(f"\nGenerated random 200x200 JPEG ({len(jpeg_data)} bytes)")

    # Verify it's actually JPEG
    if jpeg_data[:2] != b"\xff\xd8":
        print("ERROR: Generated data is not valid JPEG!")
        return

    # Upload
    upload_id = str(int(time.time()))
    entity_name = f"{upload_id}_0_{random.randint(1000000000, 9999999999)}"

    print(f"upload_id: {upload_id}")
    print(f"entity_name: {entity_name}")

    # The critical header IG requires — JSON metadata about the upload
    rupload_params = json.dumps({
        "retry_context": json.dumps({
            "num_step_auto_retry": 0,
            "num_reupload": 0,
            "num_step_manual_retry": 0,
        }),
        "media_type": 1,
        "upload_id": upload_id,
        "image_compression": json.dumps({
            "lib_name": "moz",
            "lib_version": "3.1.m",
            "quality": "80",
        }),
        "xsharing_user_ids": "[]",
    })

    upload_headers = {
        **HEADERS,
        "x-instagram-rupload-params": rupload_params,
        "x-entity-name": entity_name,
        "x-entity-length": str(len(jpeg_data)),
        "x-entity-type": "image/jpeg",
        "content-type": "image/jpeg",
        "offset": "0",
        "sec-fetch-site": "same-site",
    }

    print(f"Uploading to: https://i.instagram.com/rupload_igphoto/{entity_name}")

    resp = requests.post(
        f"https://i.instagram.com/rupload_igphoto/{entity_name}",
        headers=upload_headers,
        data=jpeg_data,
    )

    print(f"\nStatus: {resp.status_code}")

    if resp.ok:
        data = resp.json()
        print("SUCCESS — photo uploaded")
        print(json.dumps(data, indent=2))
    else:
        print("FAILED")
        print(resp.text[:1000])

    return resp


if __name__ == "__main__":
    test_upload()
