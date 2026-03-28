from fastapi import APIRouter

from server.models.schemas import StoryUploadRequest, RepostReelRequest
from server.services import stories

router = APIRouter(prefix="/story", tags=["story"])


@router.post("/upload")
def upload_story(req: StoryUploadRequest):
    return stories.upload_story(req.file_path, req.caption)


@router.post("/repost-reel")
def repost_reel(req: RepostReelRequest):
    return stories.repost_reel_to_story(req.reel_url, req.caption)
