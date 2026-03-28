"""
Instagram comment posting.
"""

import requests

from server.dependencies import rate_limited_request, _get_headers


def comment_on_post(media_id, text):
    """Post a comment on an Instagram post/reel."""
    headers = {**_get_headers(), "content-type": "application/x-www-form-urlencoded"}

    resp = requests.post(
        f"https://www.instagram.com/api/v1/web/comments/{media_id}/add/",
        headers=headers,
        data={"comment_text": text},
    )

    if resp.ok:
        return {"success": True, "data": resp.json()}
    return {"success": False, "status": resp.status_code, "error": resp.text[:500]}


def get_user_recent_media_id(user_id):
    """Get the media_id of a user's most recent post."""
    status, data = rate_limited_request(
        f"https://www.instagram.com/api/v1/feed/user/{user_id}/?count=1"
    )
    if status == 200 and data.get("items"):
        item = data["items"][0]
        return str(item.get("pk") or item.get("id")), (item.get("caption") or {}).get("text", "")
    return None, None
