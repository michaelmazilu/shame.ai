"""
Download an Instagram reel and repost it to your Story.

Usage:
    python test/ig_reel_to_story.py <reel_url_or_shortcode> [caption]

Examples:
    python test/ig_reel_to_story.py https://www.instagram.com/reels/DWZkVB5gXdx/
    python test/ig_reel_to_story.py DWZkVB5gXdx "check this out"
"""

import sys
import tempfile
from pathlib import Path

from instagrapi.types import Media


def extract_shortcode(reel_url_or_shortcode):
    """Extract shortcode from a reel URL or return as-is if already a shortcode."""
    shortcode = reel_url_or_shortcode.strip().rstrip("/")
    for prefix in ("/reel/", "/reels/", "/p/"):
        if prefix in shortcode:
            shortcode = shortcode.split(prefix)[-1].split("/")[0].split("?")[0]
            break
    return shortcode


def main():
    if len(sys.argv) < 2:
        print("Usage: python test/ig_reel_to_story.py <reel_url_or_shortcode> [caption]")
        sys.exit(1)

    reel_input = sys.argv[1]
    caption = sys.argv[2] if len(sys.argv) > 2 else ""

    shortcode = extract_shortcode(reel_input)
    print(f"=== Shortcode: {shortcode} ===")

    # Auth
    from ig_auth import get_client

    print("=== Authenticating ===")
    cl = get_client()

    # Resolve shortcode to media PK
    print("=== Resolving media PK ===")
    try:
        media_pk = cl.media_pk_from_code(shortcode)
        print(f"  Media PK: {media_pk}")
    except Exception as e:
        print(f"ERROR: Could not resolve shortcode '{shortcode}' — {e}")
        sys.exit(1)

    # Download the reel video
    print("=== Downloading reel video ===")
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        video_path = cl.clip_download(media_pk, folder=tmp_dir)
        print(f"  Downloaded to: {video_path}")
    except Exception as e:
        print(f"ERROR: Download failed — {e}")
        # Cleanup temp dir
        for f in tmp_dir.iterdir():
            f.unlink()
        tmp_dir.rmdir()
        sys.exit(1)

    # Upload as story
    print("=== Uploading to story ===")
    try:
        result = cl.video_upload_to_story(str(video_path), caption)
        print("=== Story uploaded! ===")
        print(f"  Media ID: {result.id}")
        print(f"  Media PK: {result.pk}")
    except Exception as e:
        print(f"ERROR: Story upload failed — {e}")
        sys.exit(1)
    finally:
        # Cleanup downloaded file
        for f in tmp_dir.iterdir():
            f.unlink()
        tmp_dir.rmdir()
        print("  Cleaned up temp files")


if __name__ == "__main__":
    main()
