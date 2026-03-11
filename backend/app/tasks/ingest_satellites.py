import asyncio
import logging
import os
from datetime import timedelta

import httpx
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert

from app.db import AsyncSessionLocal
from app.models.satellite import Satellite, derive_constellation

logger = logging.getLogger(__name__)

CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json"


async def fetch_and_upsert_satellites() -> int:
    """Fetch the CelesTrak active catalog and upsert all records into PostgreSQL.

    Returns the number of records upserted.
    """
    logger.info("Starting CelesTrak satellite ingest from %s", CELESTRAK_URL)

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(CELESTRAK_URL)
        resp.raise_for_status()
        records = resp.json()

    logger.info("Fetched %d records from CelesTrak", len(records))

    async with AsyncSessionLocal() as session:
        for rec in records:
            stmt = (
                insert(Satellite)
                .values(
                    norad_cat_id=int(rec["NORAD_CAT_ID"]),
                    object_name=rec.get("OBJECT_NAME", ""),
                    constellation=derive_constellation(rec.get("OBJECT_NAME", "")),
                    epoch=rec.get("EPOCH", ""),
                    mean_motion=float(rec.get("MEAN_MOTION", 0.0)),
                    eccentricity=float(rec.get("ECCENTRICITY", 0.0)),
                    inclination=float(rec.get("INCLINATION", 0.0)),
                    ra_of_asc_node=float(rec.get("RA_OF_ASC_NODE", 0.0)),
                    arg_of_pericenter=float(rec.get("ARG_OF_PERICENTER", 0.0)),
                    mean_anomaly=float(rec.get("MEAN_ANOMALY", 0.0)),
                    bstar=float(rec.get("BSTAR", 0.0)),
                    mean_motion_dot=float(rec.get("MEAN_MOTION_DOT", 0.0)),
                    mean_motion_ddot=float(rec.get("MEAN_MOTION_DDOT", 0.0)),
                    raw_omm=rec,
                )
                .on_conflict_do_update(
                    index_elements=["norad_cat_id"],
                    set_={
                        "object_name": rec.get("OBJECT_NAME", ""),
                        "constellation": derive_constellation(rec.get("OBJECT_NAME", "")),
                        "epoch": rec.get("EPOCH", ""),
                        "mean_motion": float(rec.get("MEAN_MOTION", 0.0)),
                        "eccentricity": float(rec.get("ECCENTRICITY", 0.0)),
                        "inclination": float(rec.get("INCLINATION", 0.0)),
                        "ra_of_asc_node": float(rec.get("RA_OF_ASC_NODE", 0.0)),
                        "arg_of_pericenter": float(rec.get("ARG_OF_PERICENTER", 0.0)),
                        "mean_anomaly": float(rec.get("MEAN_ANOMALY", 0.0)),
                        "bstar": float(rec.get("BSTAR", 0.0)),
                        "mean_motion_dot": float(rec.get("MEAN_MOTION_DOT", 0.0)),
                        "mean_motion_ddot": float(rec.get("MEAN_MOTION_DDOT", 0.0)),
                        "raw_omm": rec,
                        "updated_at": func.now(),
                    },
                )
            )
            await session.execute(stmt)
        await session.commit()

    logger.info("Upserted %d satellite records into PostgreSQL", len(records))
    return len(records)


def sync_fetch_and_upsert_satellites() -> None:
    """RQ-safe synchronous wrapper around fetch_and_upsert_satellites.

    Runs the async ingest, then self-re-enqueues this function in 2 hours
    so the catalog stays fresh without relying on RQ Repeat (version-unstable).
    """
    asyncio.run(fetch_and_upsert_satellites())

    # Self-re-enqueue pattern: avoids RQ Repeat(times=-1) version uncertainty
    from redis import Redis
    from rq import Queue

    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    conn = Redis.from_url(redis_url)
    q = Queue(connection=conn)
    q.enqueue_in(timedelta(hours=2), sync_fetch_and_upsert_satellites)
    logger.info("Re-enqueued satellite ingest job; next run in 2 hours")
