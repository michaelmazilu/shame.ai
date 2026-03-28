"""
Shared singletons — rate-limited HTTP client, instagrapi client.
"""

import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

from server.config import get_settings

DELAY_READ = 0.5
DELAY_WRITE = 3.0

ssl_ctx = ssl.create_default_context()

_last_call_time = 0


def rate_limited_request(url, method="GET", data=None, extra_headers=None):
    """Make a rate-limited request to Instagram API."""
    global _last_call_time

    settings = get_settings()
    is_write = method == "POST"
    min_delay = DELAY_WRITE if is_write else DELAY_READ

    elapsed = time.time() - _last_call_time
    if elapsed < min_delay:
        time.sleep(min_delay - elapsed)
    _last_call_time = time.time()

    headers = settings.headers()
    if extra_headers:
        headers.update(extra_headers)

    if data and isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode()
        headers["content-type"] = "application/x-www-form-urlencoded"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        body = json.loads(resp.read().decode())
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
SESSION_PATH = Path(__file__).resolve().parent / "session.json"

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


# -- GraphQL token scraping --

_cached_tokens = None


def get_graphql_tokens():
    """Get GraphQL tokens — scrape from page if .env ones are stale."""
    global _cached_tokens
    if _cached_tokens is not None:
        return _cached_tokens

    settings = get_settings()

    # Try scraping fresh tokens from the IG page
    headers = settings.headers()
    req = urllib.request.Request("https://www.instagram.com/", headers=headers)
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx)
        html = resp.read().decode("utf-8", errors="replace")

        dtsg_match = re.search(r'"DTSGInitialData".*?"token":"([^"]+)"', html)
        lsd_match = re.search(r'"LSD".*?"token":"([^"]+)"', html)

        if dtsg_match and lsd_match:
            _cached_tokens = {
                "fb_dtsg": dtsg_match.group(1),
                "lsd": lsd_match.group(1),
            }
            return _cached_tokens
    except Exception:
        pass

    # Fallback to .env values
    _cached_tokens = settings.graphql_tokens
    return _cached_tokens
