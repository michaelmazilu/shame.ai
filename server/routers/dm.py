from fastapi import APIRouter

from server.models.schemas import DMRequest, ConfessionRequest, ReelDMRequest
from server.services import dm as dm_svc
from server.services import ai as ai_svc

router = APIRouter(prefix="/dm", tags=["dm"])


@router.post("/send")
def send_dm(req: DMRequest):
    return dm_svc.send_dm(req.recipient_id, req.text)


@router.post("/confession")
def send_confession(req: ConfessionRequest):
    text = ai_svc.generate_confession(req.username, req.full_name, req.bio)
    result = dm_svc.send_dm(req.recipient_id, text)
    return {**result, "message": text}


@router.post("/reel")
def send_reel(req: ReelDMRequest):
    return dm_svc.send_reel_dm(req.recipient_id, req.reel_url, req.text)
