"""
Instagram auth via instagrapi.
Handles login, session persistence, device simulation, and 2FA challenges.

Usage:
    from ig_auth import get_client
    cl = get_client()
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from instagrapi import Client
from instagrapi.exceptions import (
    BadPassword,
    ChallengeRequired,
    LoginRequired,
    TwoFactorRequired,
)

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

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


def challenge_code_handler(username, choice):
    """Interactive 2FA/challenge handler. Prompts user in terminal."""
    methods = {0: "SMS", 1: "Email"}
    method = methods.get(choice, f"method {choice}")
    code = input(f"\n[2FA] Enter the verification code sent via {method} for @{username}: ")
    return code


def get_client():
    """Authenticate and return an instagrapi Client with a persistent session."""
    username = os.getenv("IG_USERNAME")
    password = os.getenv("IG_PASSWORD")

    if not username or not password:
        print("ERROR: IG_USERNAME and IG_PASSWORD must be set in .env")
        sys.exit(1)

    cl = Client()
    cl.set_device(DEVICE)
    cl.challenge_code_handler = challenge_code_handler

    try:
        if SESSION_PATH.exists():
            cl.load_settings(str(SESSION_PATH))
            print(f"Loaded session from {SESSION_PATH.name}")
            cl.login(username, password)
        else:
            print(f"No existing session, logging in as @{username}...")
            cl.login(username, password)

        cl.dump_settings(str(SESSION_PATH))
        print(f"Session saved to {SESSION_PATH.name}")
        return cl

    except BadPassword:
        print("ERROR: Bad password. Check IG_PASSWORD in .env")
        _cleanup_session()
        sys.exit(1)
    except TwoFactorRequired:
        print("ERROR: 2FA required but handler failed. Try again.")
        _cleanup_session()
        sys.exit(1)
    except ChallengeRequired:
        print("ERROR: Instagram challenge required but could not be resolved.")
        _cleanup_session()
        sys.exit(1)
    except LoginRequired:
        print("ERROR: Login failed — session may be expired.")
        _cleanup_session()
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Login failed — {e}")
        _cleanup_session()
        sys.exit(1)


def _cleanup_session():
    """Remove stale session file so next run does a fresh login."""
    if SESSION_PATH.exists():
        SESSION_PATH.unlink()
        print(f"Removed stale {SESSION_PATH.name}")
