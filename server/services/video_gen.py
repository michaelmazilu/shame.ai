"""
Video generation via Azure OpenAI Sora-2.

Sora-2 supports image+text → video. The workflow is async:
1. Submit a generation job → get job_id
2. Poll until status is "succeeded"
3. Download the video from the returned URL
"""

import requests

from server.config import get_settings


def _get_base_url():
    settings = get_settings()
    return settings.azure_openai_endpoint.rstrip("/") + "/openai/deployments/sora/videos/generations"


def _headers():
    settings = get_settings()
    return {
        "api-key": settings.azure_openai_api_key,
        "Content-Type": "application/json",
    }


def submit_video_job(prompt, image_b64=None, mime_type="image/png", duration=5, n=1):
    """Submit a video generation job to Sora-2.

    Args:
        prompt: Text description of the video to generate.
        image_b64: Optional base64-encoded image as starting frame.
        mime_type: MIME type of the input image.
        duration: Video duration in seconds (5 or 10).
        n: Number of videos to generate.

    Returns:
        dict with job_id and status, or error.
    """
    body = {
        "prompt": prompt,
        "n": n,
        "size": "1080x1920",  # vertical video for stories
        "duration": duration,
    }

    if image_b64:
        data_url = f"data:{mime_type};base64,{image_b64}"
        body["image"] = data_url

    resp = requests.post(
        _get_base_url(),
        params={"api-version": "2025-04-01-preview"},
        headers=_headers(),
        json=body,
    )

    if resp.status_code == 202:
        # Async job accepted — extract job ID from headers or body
        data = resp.json() if resp.text else {}
        job_id = data.get("id") or resp.headers.get("operation-location", "").split("/")[-1].split("?")[0]
        return {"success": True, "job_id": job_id, "status": "running"}

    if resp.ok:
        data = resp.json()
        job_id = data.get("id", "")
        return {"success": True, "job_id": job_id, "status": data.get("status", "running")}

    return {"success": False, "error": resp.text[:500], "status_code": resp.status_code}


def check_video_status(job_id):
    """Poll the status of a video generation job.

    Returns:
        dict with status ("running", "succeeded", "failed") and video URLs if done.
    """
    resp = requests.get(
        f"{_get_base_url()}/{job_id}",
        params={"api-version": "2025-04-01-preview"},
        headers=_headers(),
    )

    if not resp.ok:
        return {"status": "error", "error": resp.text[:500]}

    data = resp.json()
    status = data.get("status", "unknown")

    result = {"status": status}

    if status == "succeeded":
        generations = data.get("data", data.get("generations", []))
        videos = []
        for gen in generations:
            video_url = gen.get("url") or gen.get("video", {}).get("url")
            if video_url:
                videos.append({"url": video_url})
        result["videos"] = videos

    if status == "failed":
        result["error"] = data.get("error", {}).get("message", "Unknown error")

    return result
