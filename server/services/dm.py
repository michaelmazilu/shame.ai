"""
Instagram DM sending via GraphQL.
"""

import json
import random

from server.dependencies import rate_limited_request, get_graphql_tokens


def send_dm(recipient_id, text):
    """Send a text DM via GraphQL."""
    tokens = get_graphql_tokens()
    offline_id = str(random.randint(10**18, 9 * 10**18))
    variables = {
        "ig_thread_igid": None,
        "offline_threading_id": offline_id,
        "recipient_igids": [str(recipient_id)],
        "replied_to_client_context": None,
        "replied_to_item_id": None,
        "reply_to_message_id": None,
        "sampled": None,
        "text": {"sensitive_string_value": text},
        "mentions": [],
        "mentioned_user_ids": [],
        "commands": None,
    }
    form_data = {
        "fb_dtsg": tokens["fb_dtsg"],
        "lsd": tokens["lsd"],
        "__a": "1",
        "__user": "0",
        "__comet_req": "7",
        "fb_api_caller_class": "RelayModern",
        "fb_api_req_friendly_name": "IGDirectTextSendMutation",
        "server_timestamps": "true",
        "variables": json.dumps(variables),
        "doc_id": "25288447354146606",
    }
    status, data = rate_limited_request(
        "https://www.instagram.com/api/graphql",
        method="POST",
        data=form_data,
        extra_headers={
            "x-fb-friendly-name": "IGDirectTextSendMutation",
            "x-fb-lsd": tokens["lsd"],
        },
    )
    errors = data.get("errors", []) if isinstance(data, dict) else []
    return {"success": status == 200 and len(errors) == 0, "status": status}


def send_reel_dm(recipient_id, reel_url, text=None):
    """Send a reel via DM. Instagram auto-embeds it as a rich preview."""
    if not reel_url.startswith("http"):
        reel_url = f"https://www.instagram.com/reel/{reel_url}/"
    message = f"{reel_url}\n{text}" if text else reel_url
    return send_dm(recipient_id, message)
