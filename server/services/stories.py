"""
Instagram Story uploads via instagrapi.
"""

import tempfile
from pathlib import Path

from server.dependencies import get_ig_client

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTENSIONS = {".mp4", ".mov"}


def upload_story(file_path, caption=""):
    """Upload a photo or video to Instagram Stories."""
    cl = get_ig_client()
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext in PHOTO_EXTENSIONS:
        result = cl.photo_upload_to_story(str(path), caption)
    elif ext in VIDEO_EXTENSIONS:
        result = cl.video_upload_to_story(str(path), caption)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    return {"media_id": str(result.id), "media_pk": str(result.pk)}


def repost_reel_to_story(reel_url_or_shortcode, caption=""):
    """Download a reel and repost it to your Story."""
    cl = get_ig_client()

    # Extract shortcode
    shortcode = reel_url_or_shortcode.strip().rstrip("/")
    for prefix in ("/reel/", "/reels/", "/p/"):
        if prefix in shortcode:
            shortcode = shortcode.split(prefix)[-1].split("/")[0].split("?")[0]
            break

    media_pk = cl.media_pk_from_code(shortcode)

    tmp_dir = Path(tempfile.mkdtemp())
    try:
        video_path = cl.clip_download(media_pk, folder=tmp_dir)
        result = cl.video_upload_to_story(str(video_path), caption)
        return {"media_id": str(result.id), "media_pk": str(result.pk)}
    finally:
        for f in tmp_dir.iterdir():
            f.unlink()
        tmp_dir.rmdir()
