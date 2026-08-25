import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import verify_api_key
from app.config import settings

router = APIRouter()

REALTIME_CLIENT_SECRETS = "https://api.openai.com/v1/realtime/client_secrets"

VOICE_TOOLS = [
    {
        "type": "function",
        "name": "fly_to",
        "description": "Fly the camera to a lon/lat/alt",
        "parameters": {
            "type": "object",
            "properties": {
                "lon": {"type": "number"},
                "lat": {"type": "number"},
                "alt": {"type": "number"},
            },
            "required": ["lon", "lat"],
        },
    },
    {
        "type": "function",
        "name": "zoom_to_globe",
        "description": "Reset the camera to the home globe view",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "set_layer_visibility",
        "description": "Show or hide a named data layer",
        "parameters": {
            "type": "object",
            "properties": {
                "layer": {"type": "string"},
                "visible": {"type": "boolean"},
            },
            "required": ["layer", "visible"],
        },
    },
    {
        "type": "function",
        "name": "set_visual_preset",
        "description": "Set sensor preset: normal, nvg, crt, flir, noir",
        "parameters": {
            "type": "object",
            "properties": {"preset": {"type": "string"}},
            "required": ["preset"],
        },
    },
    {
        "type": "function",
        "name": "set_map_type",
        "description": "Set the base map type",
        "parameters": {
            "type": "object",
            "properties": {"mapType": {"type": "string"}},
            "required": ["mapType"],
        },
    },
    {
        "type": "function",
        "name": "track_contact",
        "description": "Track a selected aircraft, ship, or satellite",
        "parameters": {
            "type": "object",
            "properties": {
                "kind": {"type": "string"},
                "id": {"type": "string"},
            },
            "required": ["kind", "id"],
        },
    },
    {
        "type": "function",
        "name": "select_nearest",
        "description": "Select the nearest airborne aircraft in the current viewport",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "what_is_selected",
        "description": "Describe the currently selected contact",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "clear_selection",
        "description": "Clear selection and stop tracking",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "enter_cockpit",
        "description": "Enter heading-locked cockpit chase on the tracked aircraft",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "exit_cockpit",
        "description": "Leave cockpit chase and keep the current track",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "count_flights_in_bbox",
        "description": "Count aircraft currently loaded in the viewport",
        "parameters": {"type": "object", "properties": {}},
    },
]


def extract_client_secret(data: dict) -> str | None:
    """GA returns {value: ek_...}. Beta returned {client_secret: {value: ...}}."""
    if isinstance(data.get("value"), str) and data["value"]:
        return data["value"]
    secret = data.get("client_secret")
    if isinstance(secret, str) and secret:
        return secret
    if isinstance(secret, dict):
        value = secret.get("value")
        if isinstance(value, str) and value:
            return value
    return None


@router.get("/status")
async def voice_status():
    available = bool(settings.openai_api_key)
    return {
        "available": available,
        "model": settings.voice_model if available else None,
        "cap_usd": settings.voice_session_cap_usd,
    }


@router.post("/session", dependencies=[Depends(verify_api_key)])
async def create_voice_session():
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="Voice unavailable")

    payload = {
        "expires_after": {"anchor": "created_at", "seconds": 600},
        "session": {
            "type": "realtime",
            "model": settings.voice_model,
            "instructions": (
                "You command Intelligence Globe. Use tools to fly, track contacts, "
                "toggle layers, count flights in view, and enter or exit cockpit chase. "
                "Do not invent Google Places results. Launch ascent paths are estimates."
            ),
            "audio": {"output": {"voice": "alloy"}},
            "tools": VOICE_TOOLS,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                REALTIME_CLIENT_SECRETS,
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI unreachable: {exc}") from exc

    if res.status_code >= 400:
        raise HTTPException(status_code=502, detail="OpenAI session failed")

    secret = extract_client_secret(res.json() if res.content else {})
    if not secret:
        raise HTTPException(status_code=502, detail="OpenAI session failed")

    return {
        "client_secret": secret,
        "model": settings.voice_model,
        "cap_usd": settings.voice_session_cap_usd,
        "tools": [t["name"] for t in VOICE_TOOLS],
    }
