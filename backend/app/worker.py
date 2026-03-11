import logging
import os

from redis import Redis
from rq import Queue, Worker

logger = logging.getLogger(__name__)


def main() -> None:
    """Start the RQ worker and enqueue the first satellite and aircraft ingests immediately.

    Both ingest jobs self-re-enqueue on their own schedules:
    - Satellite ingest: every 2 hours (CelesTrak catalog refresh)
    - Aircraft ingest: every 90 seconds (OpenSky near-live positions)
    """
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    conn = Redis.from_url(redis_url)
    queue = Queue(connection=conn)

    # Enqueue first run immediately; job will self-re-enqueue every 2 hours
    queue.enqueue("app.tasks.ingest_satellites.sync_fetch_and_upsert_satellites")
    logger.info("Enqueued satellite ingest job; first run starting now")

    # Enqueue aircraft ingest; job will self-re-enqueue every 90 seconds
    queue.enqueue("app.tasks.ingest_aircraft.sync_ingest_aircraft")
    logger.info("Enqueued aircraft ingest job; first run starting now")

    worker = Worker([queue], connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
