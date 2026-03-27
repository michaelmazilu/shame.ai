"""
Test: /api/v1/friendships/show_many/
Compare with /followers/ to see what extra data we get.
Usage: python test/test_show_many.py
"""

import json

import requests

from config import active, headers

HEADERS = headers()


def main():
    # Step 1: Fetch followers for IDs
    print("=== Step 1: Fetch followers (for IDs) ===")
    resp = requests.get(
        f"https://www.instagram.com/api/v1/friendships/{active['userId']}/followers/",
        params={"count": 12, "search_surface": "follow_list_page"},
        headers=HEADERS,
    )
    data = resp.json()
    follower_ids = [str(u.get("pk") or u.get("pk_id")) for u in data.get("users", [])]
    print(f"Got {len(follower_ids)} follower IDs")
    print("Sample follower object from /followers/:")
    print(json.dumps(data["users"][0], indent=2))

    # Step 2: show_many with those IDs
    print("\n\n=== Step 2: show_many with same IDs ===")
    sm_resp = requests.post(
        "https://www.instagram.com/api/v1/friendships/show_many/",
        headers={
            **HEADERS,
            "content-type": "application/x-www-form-urlencoded",
            "x-instagram-ajax": "1036130560",
        },
        data={"user_ids": ",".join(follower_ids)},
    )
    print("Status:", sm_resp.status_code)
    sm_data = sm_resp.json()
    print("\nFull show_many response:")
    print(json.dumps(sm_data, indent=2)[:2000])

    # Step 3: How many IDs can show_many handle?
    print("\n\n=== Step 3: How many IDs can show_many handle? ===")
    big_batch = list(follower_ids)
    while len(big_batch) < 100:
        big_batch.extend(follower_ids)
    unique_100 = list(dict.fromkeys(big_batch))[:100]

    big_resp = requests.post(
        "https://www.instagram.com/api/v1/friendships/show_many/",
        headers={
            **HEADERS,
            "content-type": "application/x-www-form-urlencoded",
            "x-instagram-ajax": "1036130560",
        },
        data={"user_ids": ",".join(unique_100)},
    )
    print(f"Sent {len(unique_100)} IDs → Status: {big_resp.status_code}")
    big_data = big_resp.json()
    returned_count = len((big_data.get("friendship_statuses") or {}).keys())
    print(f"Returned statuses for: {returned_count} users")


if __name__ == "__main__":
    main()
