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


def generate_embarrassing_bio(current_bio=None, username=None):
    """Generate an embarrassing replacement bio."""
    context = ""
    if username:
        context += f"The account is @{username}. "
    if current_bio:
        context += f'Their current bio is: "{current_bio}". '

    resp = _get_client().chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write embarrassing Instagram bios as a dare/punishment. "
                    "Keep it to 1-2 lines max. Be funny and cringe but not offensive. "
                    "Think: over-the-top self-deprecation, weird flex, absurd confession. "
                    "No slurs, no bullying, just comedy. No hashtags."
                ),
            },
            {"role": "user", "content": f"Write an embarrassing Instagram bio. {context}"},
        ],
        max_tokens=80,
        temperature=1.0,
    )
    return resp.choices[0].message.content.strip()


def generate_cringe_comment(username=None, caption=None):
    """Generate a cringe/embarrassing comment to leave on someone's post."""
    context = ""
    if username:
        context += f"The post is by @{username}. "
    if caption:
        context += f'Caption: "{caption[:150]}". '

    resp = _get_client().chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You write embarrassing Instagram comments as a dare. "
                    "The comment should look like an overly obsessed fan or an embarrassing friend. "
                    "Keep it to 1-2 sentences. Be funny and cringe. "
                    "No slurs or bullying, just comedy. No hashtags. 0-1 emojis max."
                ),
            },
            {"role": "user", "content": f"Write an embarrassing comment. {context}"},
        ],
        max_tokens=60,
        temperature=1.0,
    )
    return resp.choices[0].message.content.strip()


def generate_pfp_prompt(username=None, full_name=None):
    """Generate a prompt for an embarrassing AI profile picture."""
    name = full_name or username or "someone"
    resp = _get_client().chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You generate image prompts for embarrassing profile pictures as a dare. "
                    "The image should be funny and absurd — NOT a real person's face. "
                    "Think: a potato with googly eyes, a badly drawn MS Paint portrait, "
                    "a cat in a business suit, a stock photo cliché. "
                    "Keep the prompt under 20 words. Just the image description, no quotes."
                ),
            },
            {"role": "user", "content": f"Generate an embarrassing profile picture prompt for {name}."},
        ],
        max_tokens=40,
        temperature=1.0,
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
