from fastapi import APIRouter

from server.models.schemas import IGSessionCreate
from server.dependencies import UserSession, set_active_session, get_active_session, get_graphql_tokens

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/session")
def create_session(req: IGSessionCreate):
    """Receive session from webapp Playwright login and activate it."""
    session = UserSession(
        cookies=req.cookies,
        csrf_token=req.csrf_token,
        user_id=req.user_id,
        username=req.username,
        fb_dtsg=req.fb_dtsg,
        lsd=req.lsd,
    )
    set_active_session(session)

    # If Playwright didn't grab GraphQL tokens, scrape them now
    tokens = get_graphql_tokens()
    has_tokens = bool(tokens.get("fb_dtsg") and tokens.get("lsd"))

    return {
        "success": True,
        "user_id": req.user_id,
        "username": req.username,
        "has_graphql_tokens": has_tokens,
    }


@router.get("/status")
def auth_status():
    """Check if a user session is active."""
    session = get_active_session()
    if not session:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "user_id": session.user_id,
        "username": session.username,
        "has_graphql_tokens": bool(session.fb_dtsg and session.lsd),
    }
