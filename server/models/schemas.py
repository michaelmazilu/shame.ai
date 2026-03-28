"""
Pydantic request/response models.
"""

from typing import Optional
from pydantic import BaseModel


# -- Auth --

class IGSessionCreate(BaseModel):
    """Session data from webapp Playwright login."""
    cookies: str
    csrf_token: str
    user_id: str
    username: str = ""
    fb_dtsg: Optional[str] = None
    lsd: Optional[str] = None


# -- DM --

class DMRequest(BaseModel):
    recipient_id: str
    text: str


class ConfessionRequest(BaseModel):
    recipient_id: str
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None


class ReelDMRequest(BaseModel):
    recipient_id: str
    reel_url: str
    text: Optional[str] = None


# -- Story --

class StoryUploadRequest(BaseModel):
    file_path: str
    caption: str = ""


class RepostReelRequest(BaseModel):
    reel_url: str
    caption: str = ""


# -- Comment --

class CommentRequest(BaseModel):
    media_id: str
    text: str


class RandomReelCommentRequest(BaseModel):
    text: Optional[str] = None  # None = AI-generated
    source: str = "trending"  # "trending" or "explore"


# -- Media --

class ImageGenRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"


class ImageEditRequest(BaseModel):
    image_b64: str
    prompt: str
    mime_type: str = "image/png"
    size: str = "1024x1024"


class VideoGenRequest(BaseModel):
    prompt: str
    image_b64: Optional[str] = None
    mime_type: str = "image/png"
    duration: int = 5


# -- Lottery --

class LotterySpinRequest(BaseModel):
    dry_run: bool = False


class LotteryResult(BaseModel):
    victim: dict
    action: str
    action_label: str
    detail: Optional[str] = None
    result: Optional[dict] = None
