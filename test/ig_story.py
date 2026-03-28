"""
Upload Instagram Stories via instagrapi.

Usage:
    python test/ig_story.py <file_path> [caption]

Examples:
    python test/ig_story.py photo.jpg
    python test/ig_story.py video.mp4 "Check this out"
"""

import sys
from pathlib import Path

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTENSIONS = {".mp4", ".mov"}
SUPPORTED = PHOTO_EXTENSIONS | VIDEO_EXTENSIONS


def main():
    if len(sys.argv) < 2:
        print("Usage: python test/ig_story.py <file_path> [caption]")
        sys.exit(1)

    file_path = Path(sys.argv[1]).resolve()
    caption = sys.argv[2] if len(sys.argv) > 2 else ""

    # Validate file
    if not file_path.exists():
        print(f"ERROR: File not found: {file_path}")
        sys.exit(1)

    ext = file_path.suffix.lower()
    if ext not in SUPPORTED:
        print(f"ERROR: Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED))}")
        sys.exit(1)

    # Auth
    from ig_auth import get_client

    print("=== Authenticating ===")
    cl = get_client()

    # Upload
    is_photo = ext in PHOTO_EXTENSIONS
    media_type = "photo" if is_photo else "video"
    print(f"=== Uploading {media_type} story: {file_path.name} ===")

    try:
        if is_photo:
            result = cl.photo_upload_to_story(str(file_path), caption)
        else:
            result = cl.video_upload_to_story(str(file_path), caption)

        print(f"=== Story uploaded! ===")
        print(f"Media ID: {result.id}")
        print(f"Media PK: {result.pk}")

    except Exception as e:
        print(f"ERROR: Upload failed — {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
