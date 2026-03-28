"""
Server configuration — loads from root .env via pydantic-settings.
"""

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # Instagram account 1
    account1_user_id: str = ""
    account1_cookies: str = ""
    account1_csrftoken: str = ""

    # Instagram account 2
    account2_user_id: str = ""
    account2_cookies: str = ""
    account2_csrftoken: str = ""

    # Session headers
    x_ig_www_claim: str = ""
    x_instagram_ajax: str = "1036193752"
    user_agent: str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"

    # GraphQL tokens
    fb_dtsg: str = ""
    lsd: str = ""

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""

    # instagrapi login
    ig_username: str = ""
    ig_password: str = ""

    # Server
    api_key: str = "shame-ai-dev-key"

    model_config = {"env_file": str(ENV_PATH), "extra": "ignore"}

    @property
    def accounts(self):
        return [
            {
                "name": "account1",
                "userId": self.account1_user_id,
                "cookies": self.account1_cookies,
                "csrftoken": self.account1_csrftoken,
            },
            {
                "name": "account2",
                "userId": self.account2_user_id,
                "cookies": self.account2_cookies,
                "csrftoken": self.account2_csrftoken,
            },
        ]

    @property
    def active_account(self):
        return self.accounts[0]

    @property
    def shared_headers(self):
        return {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "sec-ch-prefers-color-scheme": "dark",
            "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
            "sec-ch-ua-full-version-list": '"Chromium";v="146.0.7680.155", "Not-A.Brand";v="24.0.0.0", "Google Chrome";v="146.0.7680.155"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-model": '""',
            "sec-ch-ua-platform": '"macOS"',
            "sec-ch-ua-platform-version": '"15.7.3"',
            "user-agent": self.user_agent,
            "x-asbd-id": "359341",
            "x-ig-app-id": "936619743392459",
            "x-ig-www-claim": self.x_ig_www_claim,
            "x-instagram-ajax": self.x_instagram_ajax,
            "x-requested-with": "XMLHttpRequest",
            "referer": "https://www.instagram.com/",
            "origin": "https://www.instagram.com",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
        }

    @property
    def graphql_tokens(self):
        return {"fb_dtsg": self.fb_dtsg, "lsd": self.lsd}

    def headers(self):
        acct = self.active_account
        return {
            **self.shared_headers,
            "x-csrftoken": acct["csrftoken"],
            "cookie": acct["cookies"],
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
