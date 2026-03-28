"""
Instagram profile info and mutuals fetching.
"""

import urllib.parse

from server.dependencies import rate_limited_request
from server.config import get_settings
from server.services.cache import get_mutuals_cached


def get_profile_info(username):
    """Fetch full profile info for a username."""
    url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(username)}"
    status, data = rate_limited_request(url)
    if status != 200:
        return None
    user = (data.get("data") or {}).get("user")
    if not user:
        return None
    mutual_edges = (user.get("edge_mutual_followed_by") or {}).get("edges", [])
    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "fullName": user.get("full_name", ""),
        "bio": user.get("biography", ""),
        "profilePic": user.get("profile_pic_url_hd") or user.get("profile_pic_url", ""),
        "followers": (user.get("edge_followed_by") or {}).get("count", 0),
        "following": (user.get("edge_follow") or {}).get("count", 0),
        "postCount": (user.get("edge_owner_to_timeline_media") or {}).get("count", 0),
        "isPrivate": user.get("is_private", False),
        "isVerified": user.get("is_verified", False),
        "pronouns": user.get("pronouns", []),
        "externalUrl": user.get("external_url"),
        "mutualFollowers": (user.get("edge_mutual_followed_by") or {}).get("count", 0),
        "mutualFollowerNames": [e.get("node", {}).get("username") for e in mutual_edges],
    }


def get_mutuals():
    """Get mutual followers for the active account."""
    settings = get_settings()
    user_id = settings.active_account["userId"]
    return get_mutuals_cached(user_id, rate_limited_request)
