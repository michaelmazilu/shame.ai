import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

ACCOUNTS = [
    {
        "name": "account1",
        "userId": os.environ["ACCOUNT1_USER_ID"],
        "cookies": os.environ["ACCOUNT1_COOKIES"],
        "csrftoken": os.environ["ACCOUNT1_CSRFTOKEN"],
    },
    {
        "name": "account2",
        "userId": os.environ["ACCOUNT2_USER_ID"],
        "cookies": os.environ["ACCOUNT2_COOKIES"],
        "csrftoken": os.environ["ACCOUNT2_CSRFTOKEN"],
    },
]

SHARED_HEADERS = {
    "accept-language": "en-US,en;q=0.9",
    "sec-ch-prefers-color-scheme": "dark",
    "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"macOS"',
    "sec-ch-ua-platform-version": '"15.7.3"',
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    "x-asbd-id": "359341",
    "x-ig-app-id": "936619743392459",
    "x-requested-with": "XMLHttpRequest",
    "referer": "https://www.instagram.com/",
    "origin": "https://www.instagram.com",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
}

# GraphQL tokens (from intercepted requests — account2)
GRAPHQL_TOKENS = {
    "fb_dtsg": os.environ["FB_DTSG"],
    "lsd": os.environ["LSD"],
}

# Default to account2 (freshest session)
active = ACCOUNTS[1]


def headers():
    """Merged headers for the active account."""
    return {
        **SHARED_HEADERS,
        "x-csrftoken": active["csrftoken"],
        "cookie": active["cookies"],
    }
