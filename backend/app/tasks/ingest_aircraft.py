"""
OpenSky Network aircraft ingest RQ task.

Fetches an OAuth2 Bearer token from the OpenSky identity server, polls the
/states/all endpoint for all tracked aircraft, and batch-upserts valid records
(those with a known position) into the aircraft table.

The sync wrapper self-re-enqueues every 90 seconds to stay within the
4,000-credit/day OpenSky budget while keeping positions near-live.

IMPORTANT: OpenSky Basic Auth is DEAD as of March 18, 2026.
Only Bearer tokens via the client_credentials grant are accepted.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import timedelta

import httpx
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import AsyncSessionLocal
from app.models.aircraft import Aircraft

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OPENSKY_TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network"
    "/protocol/openid-connect/token"
)
OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all"
POLL_INTERVAL_SECONDS = 90
TRAIL_MAX_LEN = 20


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


async def fetch_opensky_token(client_id: str, client_secret: str) -> str:
    """Obtain a short-lived Bearer token via the client_credentials grant.

    Args:
        client_id:     Value of OPENSKY_CLIENT_ID environment variable.
        client_secret: Value of OPENSKY_CLIENT_SECRET environment variable.

    Returns:
        The access_token string from the identity server response.

    Raises:
        httpx.HTTPStatusError: When the identity server returns a non-2xx status.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def fetch_aircraft_states(token: str) -> list:
    """Poll the OpenSky /states/all endpoint and return the state-vector list.

    Args:
        token: Valid Bearer access token from fetch_opensky_token().

    Returns:
        List of state vectors (each a 17-element list).  Empty list when the
        API returns no states.

    Raises:
        RuntimeError: When the server responds with HTTP 429 (rate-limited).
        httpx.HTTPStatusError: For any other non-2xx response.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            OPENSKY_STATES_URL,
            headers={"Authorization": f"Bearer {token}"},
        )

        if resp.status_code == 429:
            retry_after = resp.headers.get("X-Rate-Limit-Retry-After-Seconds", "unknown")
            logger.warning(
                "OpenSky rate-limited (429). Retry-After: %s seconds. "
                "Self-re-enqueue will still fire in %ds.",
                retry_after,
                POLL_INTERVAL_SECONDS,
            )
            raise RuntimeError(
                f"OpenSky returned 429 — retry after {retry_after}s"
            )

        resp.raise_for_status()
        data = resp.json()
        return data.get("states") or []


# ---------------------------------------------------------------------------
# Core ingest function
# ---------------------------------------------------------------------------


async def ingest_aircraft() -> int:
    """Fetch all aircraft states from OpenSky and upsert into PostgreSQL.

    Workflow:
    1. Read credentials from environment (raises KeyError with clear message if absent).
    2. Obtain OAuth2 Bearer token.
    3. Poll /states/all.
    4. Filter state vectors missing a position (sv[5] or sv[6] is None).
    5. Pre-fetch existing trails in one SELECT to avoid N+1 queries.
    6. Build updated trail for each aircraft (cap at TRAIL_MAX_LEN).
    7. Batch-upsert into aircraft table.

    Returns:
        Number of aircraft rows upserted.

    Raises:
        KeyError: When OPENSKY_CLIENT_ID or OPENSKY_CLIENT_SECRET is not set.
    """
    client_id = os.environ.get("OPENSKY_CLIENT_ID")
    client_secret = os.environ.get("OPENSKY_CLIENT_SECRET")

    if not client_id:
        raise KeyError(
            "OPENSKY_CLIENT_ID environment variable is not set. "
            "Set it in your .env file or docker-compose.yml."
        )
    if not client_secret:
        raise KeyError(
            "OPENSKY_CLIENT_SECRET environment variable is not set. "
            "Set it in your .env file or docker-compose.yml."
        )

    logger.info("Starting OpenSky aircraft ingest")

    token = await fetch_opensky_token(client_id, client_secret)
    logger.info("OpenSky OAuth2 token obtained")

    raw_states = await fetch_aircraft_states(token)
    logger.info("Received %d raw state vectors from OpenSky", len(raw_states))

    # Filter: skip aircraft without a known position
    valid_states = [
        sv for sv in raw_states
        if sv[5] is not None and sv[6] is not None
    ]
    skipped = len(raw_states) - len(valid_states)
    logger.info(
        "%d aircraft have valid position; %d skipped (null lat/lon)",
        len(valid_states),
        skipped,
    )

    if not valid_states:
        logger.warning("No aircraft with valid position — nothing to upsert")
        return 0

    async with AsyncSessionLocal() as session:
        # Pre-fetch all existing trails in one round-trip to avoid N+1 queries
        existing_result = await session.execute(
            select(Aircraft.icao24, Aircraft.trail)
        )
        trail_map: dict[str, list] = {
            row.icao24: (row.trail or []) for row in existing_result
        }

        for sv in valid_states:
            icao24: str = sv[0]
            callsign: str | None = sv[1].strip() if sv[1] else None
            origin_country: str | None = sv[2]
            last_contact: int | None = sv[4]
            longitude: float = sv[5]
            latitude: float = sv[6]
            baro_altitude: float | None = sv[7]
            on_ground: bool = bool(sv[8]) if sv[8] is not None else False
            velocity: float | None = sv[9]
            true_track: float | None = sv[10]

            new_point = {
                "lon": longitude,
                "lat": latitude,
                "alt": baro_altitude,
                "ts": last_contact,
            }

            # Append new position and cap at TRAIL_MAX_LEN (oldest dropped)
            existing_trail = trail_map.get(icao24) or []
            trail = existing_trail[-(TRAIL_MAX_LEN - 1):] + [new_point]

            stmt = (
                pg_insert(Aircraft)
                .values(
                    icao24=icao24,
                    callsign=callsign,
                    origin_country=origin_country,
                    longitude=longitude,
                    latitude=latitude,
                    baro_altitude=baro_altitude,
                    on_ground=on_ground,
                    velocity=velocity,
                    true_track=true_track,
                    last_contact=last_contact,
                    trail=trail,
                )
                .on_conflict_do_update(
                    index_elements=["icao24"],
                    set_=dict(
                        callsign=callsign,
                        origin_country=origin_country,
                        longitude=longitude,
                        latitude=latitude,
                        baro_altitude=baro_altitude,
                        on_ground=on_ground,
                        velocity=velocity,
                        true_track=true_track,
                        last_contact=last_contact,
                        trail=trail,
                        updated_at=func.now(),
                    ),
                )
            )
            await session.execute(stmt)

        await session.commit()

    logger.info("Upserted %d aircraft records into PostgreSQL", len(valid_states))
    return len(valid_states)


# ---------------------------------------------------------------------------
# RQ sync wrapper
# ---------------------------------------------------------------------------


def sync_ingest_aircraft() -> None:
    """RQ-safe synchronous wrapper around ingest_aircraft().

    Runs the async ingest, then self-re-enqueues this function in
    POLL_INTERVAL_SECONDS (90s) so the aircraft table stays near-live
    without relying on RQ Repeat (version-unstable).

    If the ingest raises (e.g. missing credentials, 429), the exception is
    logged and re-raised so RQ marks the job as failed — but self-re-enqueue
    still fires so the next poll attempt happens at the scheduled interval.
    """
    try:
        asyncio.run(ingest_aircraft())
    except Exception as exc:
        logger.exception("Aircraft ingest failed: %s", exc)
        raise
    finally:
        # Always re-enqueue, even after failure, so the task loop keeps running
        from redis import Redis
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_aircraft)
        logger.info(
            "Re-enqueued aircraft ingest; next run in %ds",
            POLL_INTERVAL_SECONDS,
        )
