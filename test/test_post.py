"""
Test posting a photo to Instagram feed.

Generates a random 200x200 JPEG, uploads it via rupload, then publishes
via /api/v1/media/configure/.

Usage: python test/test_post.py [caption]

WARNING: This will actually publish a post to your account!
"""

import json
import random
import sys
import time

import requests

from config import active, headers
from test_upload import make_random_jpeg

HEADERS = headers()


def test_post():
    caption = sys.argv[1] if len(sys.argv) > 1 else "[ShotTaker test] random noise post"
    print(f"Using account: {active['name']} ({active['userId']})")

    # Step 1: Generate JPEG
    jpeg_data = make_random_jpeg()
    print(f"\nGenerated random 200x200 JPEG ({len(jpeg_data)} bytes)")

    if jpeg_data[:2] != b"\xff\xd8":
        print("ERROR: Generated data is not valid JPEG!")
        return

    # Step 2: Upload to rupload
    upload_id = str(int(time.time()))
    entity_name = f"{upload_id}_0_{random.randint(1000000000, 9999999999)}"

    print(f"\n--- Step 1: Upload ---")
    print(f"  upload_id: {upload_id}")
    print(f"  entity_name: {entity_name}")

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

    resp = requests.post(
        f"https://i.instagram.com/rupload_igphoto/{entity_name}",
        headers=upload_headers,
        data=jpeg_data,
    )

    print(f"  Status: {resp.status_code}")

    if not resp.ok:
        print("  FAILED — upload rejected")
        print(" ", resp.text[:500])
        return

    upload_data = resp.json()
    print(f"  Upload response: {json.dumps(upload_data, indent=2)[:300]}")

    # Step 3: Configure / publish
    print(f"\n--- Step 2: Configure (publish) ---")
    print(f'  Caption: "{caption}"')
    print("  Waiting 3s...")
    time.sleep(3)

    resp = requests.post(
        "https://www.instagram.com/api/v1/media/configure/",
        headers={**HEADERS, "content-type": "application/x-www-form-urlencoded"},
        data={
            "upload_id": upload_id,
            "caption": caption,
            "source_type": "4",
        },
    )

    print(f"  Status: {resp.status_code}")

    if resp.ok:
        data = resp.json()
        media = data.get("media") or {}
        code = media.get("code")
        print("  SUCCESS — post published!")
        print(f"  media_id: {media.get('id')}")
        print(f"  code: {code}")
        if code:
            print(f"  URL: https://www.instagram.com/p/{code}/")
        print(f"\n  Full response:\n{json.dumps(data, indent=2)[:800]}")
    else:
        print("  FAILED — configure rejected")
        print(" ", resp.text[:500])


if __name__ == "__main__":
    test_post()
