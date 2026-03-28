"""
Lottery spin endpoint — pick a random mutual and random action.
"""

import random

from fastapi import APIRouter

from server.models.schemas import LotterySpinRequest, LotteryResult
from server.services import profile, ai, dm, comments, reels, stories, image_gen

router = APIRouter(prefix="/lottery", tags=["lottery"])

RITUALS = [
    {"id": "love_confession", "label": "Love Confession DM", "weight": 25},
    {"id": "reel_comment", "label": "Comment on Random Reel", "weight": 20},
    {"id": "send_reel", "label": "Send Random Reel via DM", "weight": 20},
    {"id": "story_upload", "label": "AI Image → Story", "weight": 15},
    {"id": "reel_to_story", "label": "Random Reel → Story", "weight": 10},
    {"id": "ai_video_story", "label": "AI Video → Story", "weight": 10},
]


def _pick_ritual():
    ids = [r["id"] for r in RITUALS]
    weights = [r["weight"] for r in RITUALS]
    chosen_id = random.choices(ids, weights=weights, k=1)[0]
    return next(r for r in RITUALS if r["id"] == chosen_id)


@router.post("/spin")
def spin(req: LotterySpinRequest):
    # Spin 1: WHO — random mutual
    mutuals = profile.get_mutuals()
    if not mutuals:
        return {"success": False, "error": "No mutuals found. Check your session cookies."}

    victim = random.choice(mutuals)

    # Spin 2: WHAT — weighted random ritual
    ritual = _pick_ritual()

    if req.dry_run:
        return LotteryResult(
            victim=victim,
            action=ritual["id"],
            action_label=ritual["label"],
            detail="Dry run — no action taken",
        )

    # Execute the ritual
    result = _execute_ritual(ritual["id"], victim)

    return LotteryResult(
        victim=victim,
        action=ritual["id"],
        action_label=ritual["label"],
        result=result,
    )


def _execute_ritual(ritual_id, victim):
    """Execute a ritual action on the victim."""
    match ritual_id:
        case "love_confession":
            # Get profile info for better confession
            info = profile.get_profile_info(victim["username"])
            bio = (info or {}).get("bio", "")
            full_name = (info or {}).get("fullName") or victim.get("fullName")
            text = ai.generate_confession(victim["username"], full_name, bio)
            result = dm.send_dm(victim["id"], text)
            return {**result, "message": text}

        case "reel_comment":
            reel = reels.get_random_reel()
            if not reel:
                return {"success": False, "error": "No reels found"}
            text = ai.generate_reel_comment(caption=reel["caption"], username=reel["username"])
            result = comments.comment_on_post(reel["media_id"], text)
            return {**result, "reel": reel, "comment": text}

        case "send_reel":
            reel = reels.get_random_reel()
            if not reel:
                return {"success": False, "error": "No reels found"}
            result = dm.send_reel_dm(victim["id"], reel["url"])
            return {**result, "reel": reel}

        case "story_upload":
            # Generate an AI image and post to story
            prompt = f"A funny meme about @{victim['username']}"
            img_result = image_gen.generate_image(prompt)
            if not img_result.get("success"):
                return {"success": False, "error": "Image generation failed"}
            file_path = img_result["images"][0]["path"]
            story_result = stories.upload_story(file_path, f"for @{victim['username']}")
            return {**story_result, "image": img_result}

        case "reel_to_story":
            reel = reels.get_random_reel()
            if not reel:
                return {"success": False, "error": "No reels found"}
            result = stories.repost_reel_to_story(reel["shortcode"])
            return {**result, "reel": reel}

        case "ai_video_story":
            # Submit video generation job (async — returns job_id)
            from server.services import video_gen
            prompt = f"A funny short video about someone named {victim.get('fullName') or victim['username']}"
            result = video_gen.submit_video_job(prompt)
            return result

        case _:
            return {"success": False, "error": f"Unknown ritual: {ritual_id}"}
