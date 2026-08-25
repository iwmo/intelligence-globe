import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import settings

router = APIRouter()

NOMINATIM = "https://nominatim.openstreetmap.org"
GOOGLE_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_NEARBY = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
NOMINATIM_HEADERS = {
    "User-Agent": "IntelligenceGlobe/1.0 (homelab OSINT viewer; places proxy)",
    "Accept-Language": "en",
}


@router.get("/status")
async def places_status():
    google = bool(settings.google_maps_api_key)
    return {
        "available": True,
        "provider": "google" if google else "nominatim",
        "nearby": google,
    }


def _place(label: str, lat: float, lon: float, provider: str) -> dict:
    return {"label": label, "lat": lat, "lon": lon, "provider": provider}


@router.get("/geocode")
async def geocode_place(q: str = Query(..., min_length=2, max_length=120)):
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Need a place query")

    if settings.google_maps_api_key:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(
                    GOOGLE_GEOCODE,
                    params={"address": query, "key": settings.google_maps_api_key},
                )
                res.raise_for_status()
                data = res.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Google geocode unreachable: {exc}") from exc
        results = []
        for row in (data.get("results") or [])[:5]:
            loc = (row.get("geometry") or {}).get("location") or {}
            lat, lon = loc.get("lat"), loc.get("lng")
            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                results.append(_place(row.get("formatted_address") or query, float(lat), float(lon), "google"))
        return {"results": results, "provider": "google"}

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(
                f"{NOMINATIM}/search",
                params={"q": query, "format": "json", "limit": 5},
                headers=NOMINATIM_HEADERS,
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Nominatim unreachable: {exc}") from exc
    results = []
    for row in data if isinstance(data, list) else []:
        try:
            results.append(_place(str(row.get("display_name") or query), float(row["lat"]), float(row["lon"]), "nominatim"))
        except (KeyError, TypeError, ValueError):
            continue
    return {"results": results, "provider": "nominatim"}


@router.get("/reverse")
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    if settings.google_maps_api_key:
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                res = await client.get(
                    GOOGLE_GEOCODE,
                    params={"latlng": f"{lat},{lon}", "key": settings.google_maps_api_key},
                )
                res.raise_for_status()
                data = res.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Google reverse unreachable: {exc}") from exc
        rows = data.get("results") or []
        if rows:
            return _place(rows[0].get("formatted_address") or "Unknown", lat, lon, "google")
        return _place("Unknown", lat, lon, "google")

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(
                f"{NOMINATIM}/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers=NOMINATIM_HEADERS,
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Nominatim unreachable: {exc}") from exc
    addr = data.get("address") or {}
    label = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("hamlet")
        or addr.get("county")
        or data.get("display_name")
        or "Unknown"
    )
    return _place(str(label), lat, lon, "nominatim")


@router.get("/nearby")
async def nearby_places(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius: int = Query(400, ge=50, le=800),
):
    if not settings.google_maps_api_key:
        return {"available": False, "results": [], "provider": None}

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(
                GOOGLE_NEARBY,
                params={
                    "location": f"{lat},{lon}",
                    "radius": radius,
                    "key": settings.google_maps_api_key,
                },
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Google Places unreachable: {exc}") from exc

    results = []
    for row in (data.get("results") or [])[:8]:
        loc = (row.get("geometry") or {}).get("location") or {}
        plat, plon = loc.get("lat"), loc.get("lng")
        name = row.get("name")
        if name and isinstance(plat, (int, float)) and isinstance(plon, (int, float)):
            results.append({
                "label": name,
                "lat": float(plat),
                "lon": float(plon),
                "kinds": row.get("types") or [],
            })
    return {"available": True, "results": results, "provider": "google"}
