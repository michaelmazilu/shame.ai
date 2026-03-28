"""
shame.ai — FastAPI lottery backend.

Run with: uvicorn server.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.routers import auth, health, dm, story, comment, media, profile, lottery

app = FastAPI(title="shame.ai", description="Instagram lottery backend", version="0.1.0")

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
