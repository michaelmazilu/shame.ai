"""
shame.ai — FastAPI lottery backend.

Run with: uvicorn server.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.routers import auth, health, dm, story, comment, media, profile, lottery
from server.dependencies import UserSession, set_active_session
from server.config import get_settings

app = FastAPI(title="shame.ai", description="Instagram lottery backend", version="0.1.0")


@app.on_event("startup")
def _bootstrap_session():
    """Auto-activate a session from .env cookies on startup."""
    settings = get_settings()
    acct = settings.active_account
    if acct["cookies"] and acct["csrftoken"]:
        session = UserSession(
            cookies=acct["cookies"],
            csrf_token=acct["csrftoken"],
            user_id=acct["userId"],
            username="",
            fb_dtsg=settings.fb_dtsg or None,
            lsd=settings.lsd or None,
        )
        set_active_session(session)
        print(f"[startup] Auto-activated session for user {acct['userId']}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(health.router)
app.include_router(dm.router)
app.include_router(story.router)
app.include_router(comment.router)
app.include_router(media.router)
app.include_router(profile.router)
app.include_router(lottery.router)
