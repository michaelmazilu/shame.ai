"""
Test changing Instagram profile picture.

Generates a random 320x320 PNG and uploads it as the new profile pic
via /api/v1/web/accounts/web_change_profile_picture/.

Usage:
  python test/test_change_pic.py            — use a random generated image
  python test/test_change_pic.py photo.jpg  — use a specific file

WARNING: This will actually change your profile picture!
"""

import json
import os
import struct
import sys
import zlib
import random

import requests

from config import active, headers

HEADERS = headers()


def make_random_png(width=320, height=320):
    """Generate a valid PNG with random pixel colors (no dependencies)."""
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


def test_change_pic(file_path=None):
    print(f"Using account: {active['name']} ({active['userId']})")

    if file_path:
        if not os.path.isfile(file_path):
            print(f"File not found: {file_path}")
            sys.exit(1)
        print(f"\nUsing file: {file_path} ({os.path.getsize(file_path)} bytes)")
        photo_data = open(file_path, "rb").read()
        filename = os.path.basename(file_path)
    else:
        print("\nNo file provided — generating random 320x320 PNG")
        photo_data = make_random_png()
        filename = "random_pic.png"
        print(f"Generated {len(photo_data)} bytes")

    # Multipart upload — let requests set content-type with boundary
    upload_headers = {k: v for k, v in HEADERS.items() if k.lower() != "content-type"}

    print(f"\n--- Uploading profile picture ---")

    resp = requests.post(
        "https://www.instagram.com/api/v1/web/accounts/web_change_profile_picture/",
        headers=upload_headers,
        files={"profile_pic": (filename, photo_data, "image/jpeg")},
    )

    print(f"Status: {resp.status_code}")

    if resp.ok:
        data = resp.json()
        print("SUCCESS — profile picture changed!")
        print(f"\nResponse:\n{json.dumps(data, indent=2)[:800]}")
    else:
        print("FAILED")
        print(resp.text[:500])


if __name__ == "__main__":
    file_arg = sys.argv[1] if len(sys.argv) > 1 else None
    test_change_pic(file_arg)
