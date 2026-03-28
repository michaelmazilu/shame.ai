from fastapi import APIRouter

from server.models.schemas import ImageGenRequest, ImageEditRequest, VideoGenRequest
from server.services import image_gen, video_gen

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/generate-image")
def generate_image(req: ImageGenRequest):
    return image_gen.generate_image(req.prompt, req.size)


@router.post("/edit-image")
def edit_image(req: ImageEditRequest):
    return image_gen.edit_image(req.image_b64, req.prompt, req.mime_type, req.size)


@router.post("/generate-video")
def generate_video(req: VideoGenRequest):
    return video_gen.submit_video_job(
        prompt=req.prompt,
        image_b64=req.image_b64,
        mime_type=req.mime_type,
        duration=req.duration,
    )


@router.get("/video-status/{job_id}")
def video_status(job_id: str):
    return video_gen.check_video_status(job_id)
