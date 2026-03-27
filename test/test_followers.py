"""
Test: How many followers can we fetch per request?
Usage: python test/test_followers.py
Tests count=12, 50, 100, 200 to find the max.
"""

import time

import requests

from config import active, headers

HEADERS = headers()


def fetch_followers(user_id, count, max_id=None):
    params = {"count": count, "search_surface": "follow_list_page"}
    if max_id:
        params["max_id"] = max_id

    resp = requests.get(
        f"https://www.instagram.com/api/v1/friendships/{user_id}/followers/",
        params=params,
        headers=HEADERS,
    )
    print(f"  count={count} → Status: {resp.status_code}")

    if not resp.ok:
        print(f"  Body: {resp.text[:200]}")
        return None

    data = resp.json()
    users = data.get("users") or []
    next_max_id = data.get("next_max_id")

    print(f"  Returned: {len(users)} users")
    print(f"  Has more: {bool(next_max_id)}")
    if users:
        print(f"  First: @{users[0]['username']} ({users[0]['pk']})")
        print(f"  Last:  @{users[-1]['username']} ({users[-1]['pk']})")

    return {"users": users, "next_max_id": next_max_id, "count": len(users)}


def main():
    user_id = active["userId"]
    print(f"Testing followers fetch for user {user_id}\n")

    counts = [12, 50, 100, 200]

    for count in counts:
        print(f"\n--- Requesting count={count} ---")
        result = fetch_followers(user_id, count)
        if not result:
            break
        time.sleep(3)

    # Test pagination: fetch page 1 then page 2
    print("\n\n--- Pagination test (count=50, 2 pages) ---")
    page1 = fetch_followers(user_id, 50)
    if page1 and page1["next_max_id"]:
        time.sleep(3)
        print("\nPage 2:")
        page2 = fetch_followers(user_id, 50, page1["next_max_id"])

        if page2:
            page1_ids = {u["pk"] for u in page1["users"]}
            dupes = [u for u in page2["users"] if u["pk"] in page1_ids]
            print(f"\n  Duplicates between page 1 & 2: {len(dupes)}")
            print(f"  Total unique: {page1['count'] + page2['count'] - len(dupes)}")


if __name__ == "__main__":
    main()
