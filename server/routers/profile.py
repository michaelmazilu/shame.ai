from fastapi import APIRouter

from server.services import profile

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/mutuals")
def get_mutuals():
    mutuals = profile.get_mutuals()
    return {"count": len(mutuals), "mutuals": mutuals}


@router.get("/{username}")
def get_profile(username: str):
    info = profile.get_profile_info(username)
    if not info:
        return {"success": False, "error": "Profile not found"}
    return {"success": True, "profile": info}
