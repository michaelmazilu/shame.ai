from fastapi import APIRouter

from server.models.schemas import CommentRequest, RandomReelCommentRequest
from server.services import comments, reels, ai

router = APIRouter(prefix="/comment", tags=["comment"])


@router.post("/post")
def comment_on_post(req: CommentRequest):
    return comments.comment_on_post(req.media_id, req.text)


@router.post("/random-reel")
def comment_on_random_reel(req: RandomReelCommentRequest):
    """Find a random reel and comment on it."""
    reel = reels.get_random_reel(source=req.source)
    if not reel:
        return {"success": False, "error": "No reels found"}

    # Generate or use provided comment text
    text = req.text
    if not text:
        text = ai.generate_reel_comment(caption=reel["caption"], username=reel["username"])

    # Post the comment
    media_id = reel["media_id"]
    result = comments.comment_on_post(media_id, text)

    return {
        **result,
        "reel": reel,
        "comment_text": text,
    }
