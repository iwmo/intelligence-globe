import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import verify_api_key
from app.config import settings

router = APIRouter()

VOICE_TOOLS = [
    {"name": "fly_to", "description": "Fly the camera to a lon/lat/alt"},
    {"name": "zoom_to_globe", "description": "Reset the camera to the home globe view"},
    {"name": "set_layer_visibility", "description": "Show or hide a named data layer"},
    {"name": "set_visual_preset", "description": "Set sensor preset: normal, nvg, crt, flir, noir"},
    {"name": "set_map_type", "description": "Set the base map type"},
    {"name": "track_contact", "description": "Track a selected aircraft, ship, or satellite"},
    {"name": "select_nearest", "description": "Select the nearest contact in the viewport"},
    {"name": "what_is_selected", "description": "Describe the currently selected contact"},
    {"name": "clear_selection", "description": "Clear selection and stop tracking"},
    {"name": "enter_cockpit", "description": "Not available in v1"},
]


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
        "model": settings.voice_model,
        "voice": "alloy",
        "instructions": (
            "You command Intelligence Globe. Use tools to fly, track contacts, "
            "and toggle layers. Do not invent Google Places results. "
            "enter_cockpit is not available."
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/realtime/sessions",
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

    data = res.json()
    secret = data.get("client_secret", {})
    return {
        "client_secret": secret.get("value"),
        "model": settings.voice_model,
        "cap_usd": settings.voice_session_cap_usd,
        "tools": [t["name"] for t in VOICE_TOOLS],
    }
