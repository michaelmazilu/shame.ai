"""
Shared singletons — rate-limited HTTP client, instagrapi client, per-user sessions.
"""

import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

from server.config import get_settings

DELAY_READ = 0.5
DELAY_WRITE = 3.0

ssl_ctx = ssl.create_default_context()

_last_call_time = 0


# -- Per-user session store --

class UserSession:
    """Holds a single user's IG credentials + GraphQL tokens."""

    def __init__(self, cookies: str, csrf_token: str, user_id: str,
                 username: str = "", fb_dtsg: Optional[str] = None, lsd: Optional[str] = None):
        self.cookies = cookies
        self.csrf_token = csrf_token
        self.user_id = user_id
        self.username = username
        self.fb_dtsg = fb_dtsg
        self.lsd = lsd

    def headers(self):
        settings = get_settings()
        return {
            **settings.shared_headers,
            "x-csrftoken": self.csrf_token,
            "cookie": self.cookies,
        }

    def graphql_tokens(self):
        return {"fb_dtsg": self.fb_dtsg or "", "lsd": self.lsd or ""}


# Active user session — set via /auth/session, falls back to .env
_active_session: Optional[UserSession] = None


def set_active_session(session: UserSession):
    global _active_session, _cached_tokens
    _active_session = session
    # Reset cached GraphQL tokens so they come from the new session
    _cached_tokens = None


def get_active_session() -> Optional[UserSession]:
    return _active_session


def _get_headers():
    """Get request headers — from active user session or .env fallback."""
    if _active_session:
        return _active_session.headers()
    return get_settings().headers()


def _get_cookies_str() -> str:
    """Get cookie string for the active session."""
    if _active_session:
        return _active_session.cookies
    return get_settings().active_account["cookies"]


# -- Rate-limited HTTP --

def rate_limited_request(url, method="GET", data=None, extra_headers=None):
    """Make a rate-limited request to Instagram API."""
    global _last_call_time

    is_write = method == "POST"
    min_delay = DELAY_WRITE if is_write else DELAY_READ

    elapsed = time.time() - _last_call_time
    if elapsed < min_delay:
        time.sleep(min_delay - elapsed)
    _last_call_time = time.time()

    headers = _get_headers()
    if extra_headers:
        headers.update(extra_headers)

    if data and isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode()
        headers["content-type"] = "application/x-www-form-urlencoded"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        raw = resp.read().decode()
        try:
            body = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            body = {"raw": raw[:500]}
        return resp.status, body
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()[:500]
        try:
            body = json.loads(body_text)
        except Exception:
            body = body_text
        return e.code, body


# -- instagrapi singleton --

_ig_client = None
SESSION_PATH = Path(__file__).resolve().parent / "services" / "session.json"

DEVICE = {
    "app_version": "269.0.0.18.75",
    "android_version": 31,
    "android_release": "12",
    "dpi": "640dpi",
    "resolution": "1440x3200",
    "manufacturer": "Samsung",
    "device": "star2qltecs",
    "model": "SM-G965F",
    "cpu": "exynos9810",
    "version_code": "314665256",
}


def get_ig_client():
    """Lazy-initialized instagrapi Client singleton."""
    global _ig_client
    if _ig_client is not None:
        return _ig_client

    from instagrapi import Client

    settings = get_settings()
    cl = Client()
    cl.set_device(DEVICE)

    if SESSION_PATH.exists():
        cl.load_settings(str(SESSION_PATH))

    cl.login(settings.ig_username, settings.ig_password)
    cl.dump_settings(str(SESSION_PATH))

    _ig_client = cl
    return cl


# -- GraphQL token management --

_cached_tokens = None


def _scrape_graphql_tokens():
    """Scrape fresh fb_dtsg and lsd from Instagram page using current session cookies."""
    headers = _get_headers()
    req = urllib.request.Request("https://www.instagram.com/", headers=headers)
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        html = resp.read().decode("utf-8", errors="replace")

        dtsg_match = re.search(r'"DTSGInitialData".*?"token":"([^"]+)"', html)
        lsd_match = re.search(r'"LSD".*?"token":"([^"]+)"', html)

        if not dtsg_match or not lsd_match:
            dtsg_match = dtsg_match or re.search(r'fb_dtsg["\s:]+value["\s:]+([^"&]+)', html)
            lsd_match = lsd_match or re.search(r'"lsd":"([^"]+)"', html)

        if dtsg_match and lsd_match:
            return {"fb_dtsg": dtsg_match.group(1), "lsd": lsd_match.group(1)}
    except Exception:
        pass
    return None


def get_graphql_tokens():
    """Get GraphQL tokens — from active session, scrape, or .env fallback."""
    global _cached_tokens
    if _cached_tokens is not None:
        return _cached_tokens

    # 1. If the active session already has tokens from Playwright login, use those
    if _active_session and _active_session.fb_dtsg and _active_session.lsd:
        _cached_tokens = _active_session.graphql_tokens()
        return _cached_tokens

    # 2. Try scraping fresh from the page (using current session's cookies)
    scraped = _scrape_graphql_tokens()
    if scraped:
        _cached_tokens = scraped
        # Also update the active session if we have one
        if _active_session:
            _active_session.fb_dtsg = scraped["fb_dtsg"]
            _active_session.lsd = scraped["lsd"]
        return _cached_tokens

    # 3. Fallback to .env values
    _cached_tokens = get_settings().graphql_tokens
    return _cached_tokens


def refresh_graphql_tokens():
    """Force re-scrape of GraphQL tokens (call when DM fails)."""
    global _cached_tokens
    _cached_tokens = None
    return get_graphql_tokens()
