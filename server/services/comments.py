"""
Instagram comment posting.
"""

import requests

from server.config import get_settings


def comment_on_post(media_id, text):
    """Post a comment on an Instagram post/reel."""
    settings = get_settings()
    headers = {**settings.headers(), "content-type": "application/x-www-form-urlencoded"}

    resp = requests.post(
        f"https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
        headers=headers,
        data={"comment_text": text},
    )

    if resp.ok:
        return {"success": True, "data": resp.json()}
    return {"success": False, "status": resp.status_code, "error": resp.text[:500]}
