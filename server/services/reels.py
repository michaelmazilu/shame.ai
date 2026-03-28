"""
Reel discovery — find random public reels from explore/trending.
"""

import random

from server.dependencies import get_ig_client


def fetch_reels_trending(amount=10):
    """Fetch reels from the Reels tab (trending/suggested)."""
    cl = get_ig_client()
    medias = cl.clips(amount=amount)
    return [m for m in medias if m.media_type == 2 and m.product_type == "clips"]


def fetch_reels_explore(amount=20):
    """Fetch reels from the Explore page."""
    cl = get_ig_client()
    medias = cl.explore_page(amount=amount)
    return [m for m in medias if m.media_type == 2 and m.product_type == "clips"]


def fetch_reels_hashtag(tag, amount=20):
    """Fetch recent reels from a hashtag."""
    cl = get_ig_client()
    medias = cl.hashtag_medias_recent(tag, amount=amount)
    return [m for m in medias if m.product_type == "clips"]


def get_random_reel(source="trending"):
    """Get a single random reel from the specified source.

    Returns dict with reel info or None.
    """
    if source == "explore":
        reels = fetch_reels_explore()
    else:
        reels = fetch_reels_trending()

    if not reels:
        return None

    reel = random.choice(reels)
    return {
        "media_id": str(reel.pk),
        "shortcode": reel.code,
        "url": f"https://www.instagram.com/reel/{reel.code}/",
        "username": reel.user.username if reel.user else None,
        "caption": reel.caption_text or "",
        "view_count": reel.view_count or 0,
        "like_count": reel.like_count or 0,
    }


def shortcode_to_media_id(shortcode):
    """Convert an Instagram shortcode to a numeric media ID."""
    ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    media_id = 0
    for char in shortcode:
        media_id = media_id * 64 + ALPHABET.index(char)
    return str(media_id)
