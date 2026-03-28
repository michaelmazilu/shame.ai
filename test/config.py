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
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "sec-ch-prefers-color-scheme": "dark",
    "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    "sec-ch-ua-full-version-list": '"Chromium";v="146.0.7680.155", "Not-A.Brand";v="24.0.0.0", "Google Chrome";v="146.0.7680.155"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"macOS"',
    "sec-ch-ua-platform-version": '"15.7.3"',
    "user-agent": os.environ.get("USER_AGENT", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"),
    "x-asbd-id": "359341",
    "x-ig-app-id": "936619743392459",
    "x-ig-www-claim": os.environ.get("X_IG_WWW_CLAIM", ""),
    "x-instagram-ajax": os.environ.get("X_INSTAGRAM_AJAX", "1036193752"),
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

# Default to account1
active = ACCOUNTS[0]


def headers():
    """Merged headers for the active account."""
    return {
        **SHARED_HEADERS,
        "x-csrftoken": active["csrftoken"],
        "cookie": active["cookies"],
    }
