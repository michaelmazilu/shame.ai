"""
Shared cache for followers, following, and mutuals.
Stores data in server/.cache/ as JSON files.
"""

import json
import os
import time
import urllib.parse

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".cache")
DEFAULT_MAX_AGE = 3600  # 1 hour


def _cache_path(name, user_id):
    return os.path.join(CACHE_DIR, f"{name}_{user_id}.json")


def _read_cache(name, user_id, max_age):
    path = _cache_path(name, user_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            data = json.load(f)
        age = time.time() - data.get("timestamp", 0)
        if age > max_age:
            return None
        return data["users"]
    except (json.JSONDecodeError, KeyError):
        return None


def _write_cache(name, user_id, users):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = _cache_path(name, user_id)
    with open(path, "w") as f:
        json.dump({"timestamp": time.time(), "users": users}, f)


def _fetch_all_paginated(user_id, endpoint, request_fn):
    all_users = []
    max_id = None
    while True:
        url = f"https://www.instagram.com/api/v1/friendships/{user_id}/{endpoint}/?count=200&search_surface=follow_list_page"
        if max_id:
            url += f"&max_id={urllib.parse.quote(str(max_id))}"
        status, data = request_fn(url)
        if status != 200:
            break
        users = [
            {
                "id": str(u.get("pk") or u.get("pk_id")),
                "username": u.get("username"),
                "fullName": u.get("full_name", ""),
                "isPrivate": u.get("is_private", False),
            }
            for u in data.get("users", [])
        ]
        all_users.extend(users)
        max_id = data.get("next_max_id")
        if not max_id or len(users) == 0:
            break
    return all_users


def get_following_cached(user_id, request_fn, max_age=DEFAULT_MAX_AGE):
    cached = _read_cache("following", user_id, max_age)
    if cached is not None:
        return cached
    users = _fetch_all_paginated(user_id, "following", request_fn)
    _write_cache("following", user_id, users)
    return users


def get_followers_cached(user_id, request_fn, max_age=DEFAULT_MAX_AGE):
    cached = _read_cache("followers", user_id, max_age)
    if cached is not None:
        return cached
    users = _fetch_all_paginated(user_id, "followers", request_fn)
    _write_cache("followers", user_id, users)
    return users


def get_mutuals_cached(user_id, request_fn, max_age=DEFAULT_MAX_AGE):
    cached = _read_cache("mutuals", user_id, max_age)
    if cached is not None:
        return cached
    following = get_following_cached(user_id, request_fn, max_age)
    followers = get_followers_cached(user_id, request_fn, max_age)
    follower_ids = {p["id"] for p in followers}
    following_by_id = {p["id"]: p for p in following}
    mutual_ids = follower_ids & set(following_by_id.keys())
    mutuals = [following_by_id[mid] for mid in mutual_ids]
    mutuals.sort(key=lambda p: p["username"].lower())
    _write_cache("mutuals", user_id, mutuals)
    return mutuals
