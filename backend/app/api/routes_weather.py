import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"


@router.get("")
@router.get("/")
async def current_weather(
    lat: float = Query(...),
    lon: float = Query(...),
):
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m",
        "wind_speed_unit": "kn",
        "timezone": "UTC",
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(OPEN_METEO, params=params)
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Open-Meteo unreachable: {exc}") from exc

    current = data.get("current") or {}
    return {
        "lat": lat,
        "lon": lon,
        "temperature_c": current.get("temperature_2m"),
        "weather_code": current.get("weather_code"),
        "wind_kn": current.get("wind_speed_10m"),
        "wind_dir": current.get("wind_direction_10m"),
        "time": current.get("time"),
        "source": "Open-Meteo",
    }
