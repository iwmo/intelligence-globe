"""
FastAPI shared dependencies.

verify_api_key: protects write endpoints with a static API key.
Apply to routes via dependencies=[Depends(verify_api_key)].
Future write routes should import this function rather than duplicating logic.
"""
from fastapi import Header, HTTPException

from app.config import settings


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Raise HTTP 401 when X-API-Key header is missing or does not match API_KEY.

    The header parameter is optional at the HTTP level (default=None) so that
    absent headers yield 401 (not 422). The logic treats None the same as a
    wrong value — any mismatch raises 401.

    Timing-safe comparison is not used here: the threat model is a single-user
    homelab tool with no exposure to timing attacks. == is sufficient.
    """
    if x_api_key is None or x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
