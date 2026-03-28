"""
AI text generation via Azure OpenAI (GPT-4.1-mini).
"""

from openai import AzureOpenAI

from server.config import get_settings

_client = None


def _get_client():
    global _client
    if _client is None:
        settings = get_settings()
        _client = AzureOpenAI(
            api_version="2024-12-01-preview",
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
        )
    return _client


def generate_confession(username, full_name=None, bio=None):
    """Generate a love confession DM."""
    name = full_name or username
    context = f"Their name is {name} (Instagram: @{username})."
    if bio:
        context += f' Their bio says: "{bio}"'

    resp = _get_client().chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write short, flirty Instagram DMs. Keep it under 2 sentences. "
                    "Be casual, confident, a little cheesy but not cringe. "
                    "Don't use emojis excessively. No hashtags. "
                    "This is a love confession / shooting your shot message. "
                    "If you know something about them from their bio, reference it naturally."
                ),
            },
            {
                "role": "user",
                "content": f"Write a love confession DM. {context}",
            },
        ],
        max_tokens=100,
        temperature=0.9,
    )
    return resp.choices[0].message.content.strip()


def generate_reel_comment(caption=None, username=None):
    """Generate a funny/engaging comment for a reel."""
    context_parts = []
    if username:
        context_parts.append(f"The reel is by @{username}.")
    if caption:
        context_parts.append(f'The caption is: "{caption[:200]}"')
    context = " ".join(context_parts) if context_parts else "A random Instagram reel."

    resp = _get_client().chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write short, funny Instagram comments on reels. "
                    "Keep it to 1 sentence max. Be witty, relatable, or hype. "
                    "Sound like a real person, not a bot. No hashtags. "
                    "Don't use emojis excessively (0-1 max)."
                ),
            },
            {
                "role": "user",
                "content": f"Write a comment for this reel. {context}",
            },
        ],
        max_tokens=60,
        temperature=0.9,
    )
    return resp.choices[0].message.content.strip()
