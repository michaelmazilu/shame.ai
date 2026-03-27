#!/usr/bin/env python3
"""
Benchmark Instagram API rate limits.
Tests each endpoint for 60 seconds with NO artificial delay to find the real limits.
Reports: successful calls, 429s, other errors, and effective calls/minute.
"""

import json
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import ACCOUNTS, headers as config_headers

ACTIVE = ACCOUNTS[1]
ssl_ctx = ssl.create_default_context()

BOLD = "\033[1m"
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
DIM = "\033[2m"
RESET = "\033[0m"

DURATION = 60  # seconds per test


def raw_request(url, method="GET", data=None, extra_headers=None):
    """Make a single request with no rate limiting."""
    hdrs = config_headers()
    if extra_headers:
        hdrs.update(extra_headers)
    if data and isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode()
        hdrs["content-type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
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


def benchmark_endpoint(name, call_fn):
    """Run call_fn repeatedly for DURATION seconds, tracking results."""
    print(f"\n{BOLD}{'=' * 60}{RESET}")
    print(f"{BOLD}  Testing: {name}{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")

    results = []  # list of (timestamp, status, latency_ms)
    backoff_total = 0.0
    start = time.time()

    while True:
        elapsed = time.time() - start
        if elapsed >= DURATION:
            break

        t0 = time.time()
        status, body = call_fn()
        latency = (time.time() - t0) * 1000

        results.append((time.time() - start, status, latency))

        # Print live
        remaining = max(0, DURATION - (time.time() - start))
        ok_count = sum(1 for _, s, _ in results if s == 200)
        err429 = sum(1 for _, s, _ in results if s == 429)
        other_err = sum(1 for _, s, _ in results if s not in (200, 429))

        status_color = GREEN if status == 200 else RED if status == 429 else YELLOW
        print(
            f"  [{remaining:4.0f}s left] {status_color}{status}{RESET}  "
            f"{latency:6.0f}ms  |  ✓{ok_count}  ⛔{err429}  ⚠{other_err}",
            end="\r",
        )

        # If we got a 429, back off 5s to avoid getting IP-banned, but count the time
        if status == 429:
            wait = 5.0
            if time.time() - start + wait > DURATION:
                break
            print(f"\n  {RED}429 — backing off {wait}s{RESET}")
            time.sleep(wait)
            backoff_total += wait

    print()  # newline after \r

    # Summary
    total = len(results)
    ok = sum(1 for _, s, _ in results if s == 200)
    err429 = sum(1 for _, s, _ in results if s == 429)
    other = sum(1 for _, s, _ in results if s not in (200, 429))
    actual_elapsed = time.time() - start
    avg_latency = sum(l for _, _, l in results) / total if total else 0
    ok_latencies = [l for _, s, l in results if s == 200]
    avg_ok_latency = sum(ok_latencies) / len(ok_latencies) if ok_latencies else 0

    # Calculate the max sustained rate (successful calls per minute)
    calls_per_min = (ok / actual_elapsed) * 60 if actual_elapsed > 0 else 0

    # Find the "burst" — max successful calls in any 10s window
    burst_window = 10
    max_burst = 0
    for window_start in range(int(actual_elapsed - burst_window) + 1):
        count = sum(
            1 for t, s, _ in results
            if s == 200 and window_start <= t < window_start + burst_window
        )
        max_burst = max(max_burst, count)

    # Find when first 429 happened
    first_429 = None
    for t, s, _ in results:
        if s == 429:
            first_429 = t
            break

    print(f"\n  {BOLD}Results for {name}:{RESET}")
    print(f"  {'─' * 50}")
    print(f"  Total calls:        {total}")
    print(f"  {GREEN}Successful (200):{RESET}    {ok}")
    print(f"  {RED}Rate limited (429):{RESET}  {err429}")
    print(f"  {YELLOW}Other errors:{RESET}        {other}")
    print(f"  Elapsed:            {actual_elapsed:.1f}s (incl {backoff_total:.1f}s backoff)")
    print(f"  Avg latency (200):  {avg_ok_latency:.0f}ms")
    print(f"  Avg latency (all):  {avg_latency:.0f}ms")
    print(f"  {CYAN}Throughput:{RESET}          {GREEN}{calls_per_min:.1f} successful calls/min{RESET}")
    print(f"  {CYAN}Best 10s burst:{RESET}      {max_burst} calls in 10s")
    if first_429:
        print(f"  {RED}First 429 at:{RESET}       {first_429:.1f}s (after {sum(1 for t, s, _ in results if t < first_429 and s == 200)} ok calls)")
    else:
        print(f"  {GREEN}No 429s!{RESET}")

    return {
        "name": name,
        "total": total,
        "ok": ok,
        "err429": err429,
        "other": other,
        "elapsed": actual_elapsed,
        "calls_per_min": calls_per_min,
        "avg_latency_ok": avg_ok_latency,
        "max_burst_10s": max_burst,
        "first_429_at": first_429,
    }


def main():
    my_id = ACTIVE["userId"]

    print(f"\n{BOLD}🏎️  Instagram API Rate Limit Benchmark{RESET}")
    print(f"{DIM}Testing each endpoint for {DURATION}s with no artificial delay{RESET}")
    print(f"{DIM}Account: {ACTIVE['name']} (ID: {my_id}){RESET}")

    # We need some usernames/IDs for profile_info and posts tests.
    # Fetch a small batch of following first (one call, not benchmarked).
    print(f"\n{DIM}Prefetching some user IDs for benchmarks...{RESET}")
    url = f"https://www.instagram.com/api/v1/friendships/{my_id}/following/?count=50&search_surface=follow_list_page"
    status, data = raw_request(url)
    if status != 200:
        print(f"{RED}Failed to prefetch following: {status}{RESET}")
        return
    following_users = data.get("users", [])
    print(f"{DIM}Got {len(following_users)} following users for test targets{RESET}")

    if len(following_users) < 5:
        print(f"{RED}Need at least 5 following users to benchmark{RESET}")
        return

    # Prepare iterators that cycle through users
    usernames = [u["username"] for u in following_users]
    user_ids = [str(u.get("pk") or u.get("pk_id")) for u in following_users]
    username_idx = [0]
    userid_idx = [0]

    def next_username():
        u = usernames[username_idx[0] % len(usernames)]
        username_idx[0] += 1
        return u

    def next_userid():
        u = user_ids[userid_idx[0] % len(user_ids)]
        userid_idx[0] += 1
        return u

    all_results = []

    # ── Test 1: Followers ──
    follower_max_id = [None]
    def call_followers():
        url = f"https://www.instagram.com/api/v1/friendships/{my_id}/followers/?count=25&search_surface=follow_list_page"
        if follower_max_id[0]:
            url += f"&max_id={urllib.parse.quote(str(follower_max_id[0]))}"
        s, d = raw_request(url)
        if s == 200:
            follower_max_id[0] = d.get("next_max_id")
        return s, d

    all_results.append(benchmark_endpoint("GET followers", call_followers))
    time.sleep(3)  # brief pause between tests

    # ── Test 2: Following ──
    following_max_id = [None]
    def call_following():
        url = f"https://www.instagram.com/api/v1/friendships/{my_id}/following/?count=25&search_surface=follow_list_page"
        if following_max_id[0]:
            url += f"&max_id={urllib.parse.quote(str(following_max_id[0]))}"
        s, d = raw_request(url)
        if s == 200:
            following_max_id[0] = d.get("next_max_id")
        return s, d

    all_results.append(benchmark_endpoint("GET following", call_following))
    time.sleep(3)

    # ── Test 3: Profile info (web_profile_info) ──
    def call_profile_info():
        u = next_username()
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={urllib.parse.quote(u)}"
        return raw_request(url)

    all_results.append(benchmark_endpoint("GET web_profile_info", call_profile_info))
    time.sleep(3)

    # ── Test 4: User posts (feed) ──
    def call_user_posts():
        uid = next_userid()
        url = f"https://www.instagram.com/api/v1/feed/user/{uid}/?count=6"
        return raw_request(url)

    all_results.append(benchmark_endpoint("GET user feed/posts", call_user_posts))
    time.sleep(3)

    # ── Test 5: Suggested users ──
    def call_suggested():
        return raw_request(
            "https://www.instagram.com/api/v1/discover/ayml/",
            method="POST",
            data={"phone_id": "", "module": "discover_people"},
        )

    all_results.append(benchmark_endpoint("POST suggested (discover/ayml)", call_suggested))
    time.sleep(3)

    # ── Test 6: Friendship status (show) ──
    def call_friendship():
        uid = next_userid()
        url = f"https://www.instagram.com/api/v1/friendships/show/{uid}/"
        return raw_request(url)

    all_results.append(benchmark_endpoint("GET friendship/show", call_friendship))

    # ── Final comparison ──
    print(f"\n\n{BOLD}{'=' * 70}{RESET}")
    print(f"{BOLD}  COMPARISON — calls/minute (successful){RESET}")
    print(f"{BOLD}{'=' * 70}{RESET}")
    print(f"  {'Endpoint':<35} {'Calls/min':>10} {'Avg ms':>8} {'First 429':>10}")
    print(f"  {'─' * 65}")

    # Sort by throughput
    all_results.sort(key=lambda r: r["calls_per_min"], reverse=True)
    for r in all_results:
        f429 = f"{r['first_429_at']:.0f}s" if r["first_429_at"] else "never"
        bar_len = int(r["calls_per_min"] / 2)  # scale bar
        bar = "█" * min(bar_len, 30)
        print(
            f"  {r['name']:<35} {r['calls_per_min']:>8.1f}  {r['avg_latency_ok']:>7.0f}  {f429:>10}  {GREEN}{bar}{RESET}"
        )

    print(f"\n{BOLD}Recommendation:{RESET}")
    fastest = all_results[0]
    slowest = all_results[-1]
    print(f"  Fastest: {GREEN}{fastest['name']}{RESET} at {fastest['calls_per_min']:.0f} calls/min")
    print(f"  Slowest: {RED}{slowest['name']}{RESET} at {slowest['calls_per_min']:.0f} calls/min")
    print(f"  Ratio:   {fastest['calls_per_min'] / slowest['calls_per_min']:.1f}x difference")
    print()


if __name__ == "__main__":
    main()
