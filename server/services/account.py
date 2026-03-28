"""
Account modifications — bio editing, profile picture changes.
These are "self-harm" punishments that modify YOUR OWN account.
"""

import base64
import io
import requests

from server.dependencies import _get_headers, rate_limited_request


def edit_bio(new_bio):
    """Change the authenticated user's bio."""
    headers = {**_get_headers(), "content-type": "application/x-www-form-urlencoded"}
    resp = requests.post(
        "https://www.instagram.com/api/v1/web/accounts/edit/",
        headers=headers,
        data={"biography": new_bio},
    )
    if resp.ok:
        return {"success": True}
    return {"success": False, "error": resp.text[:500]}


def change_profile_picture(image_bytes):
    """Change the authenticated user's profile picture.

    Args:
        image_bytes: Raw image bytes (PNG/JPEG).
    """
    headers = _get_headers()
    # multipart upload — don't set content-type, requests handles boundary
    headers.pop("content-type", None)
    resp = requests.post(
        "https://www.instagram.com/api/v1/web/accounts/web_change_profile_picture/",
        headers=headers,
        files={"profile_pic": ("profile_pic.jpg", io.BytesIO(image_bytes), "image/jpeg")},
    )
    if resp.ok:
        return {"success": True}
    return {"success": False, "error": resp.text[:500]}


def follow_user(user_id):
    """Follow a user."""
    status, data = rate_limited_request(
        f"https://www.instagram.com/api/v1/friendships/create/{user_id}/",
        method="POST",
        data={"container_module": "profile", "user_id": user_id},
    )
    return {"success": status == 200}


def unfollow_user(user_id):
    """Unfollow a user."""
    status, data = rate_limited_request(
        f"https://www.instagram.com/api/v1/friendships/destroy/{user_id}/",
        method="POST",
        data={"container_module": "profile", "user_id": user_id},
    )
    return {"success": status == 200}
