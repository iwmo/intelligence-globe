import logging
import os

from redis import Redis
from rq import Queue, Worker

logger = logging.getLogger(__name__)


def main() -> None:
    """Start the RQ worker and enqueue the first satellite, aircraft, and military ingests immediately.

    All ingest jobs self-re-enqueue on their own schedules:
    - Satellite ingest: every 2 hours (CelesTrak catalog refresh)
    - Aircraft ingest: every 15 seconds (ADSB.lol near-live positions)
    - Military ingest: every 15 seconds (ADSB.lol ?filter_mil)
    - Snapshot positions: every 60 seconds (historical record for replay)
    """
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    conn = Redis.from_url(redis_url)
    queue = Queue(connection=conn)

    # Enqueue first run immediately; job will self-re-enqueue every 2 hours
    queue.enqueue("app.tasks.ingest_satellites.sync_fetch_and_upsert_satellites")
    logger.info("Enqueued satellite ingest job; first run starting now")

    # Enqueue commercial aircraft ingest; job will self-re-enqueue every 15 seconds
    queue.enqueue("app.tasks.ingest_adsbiol.sync_ingest_commercial")
    logger.info("Enqueued commercial aircraft ingest job (ADSB.lol); first run starting now")

    # Enqueue military ingest; job will self-re-enqueue every 15 seconds
    queue.enqueue("app.tasks.ingest_adsbiol.sync_ingest_military")
    logger.info("Enqueued military aircraft ingest job (ADSB.lol); first run starting now")

    # Enqueue GPS jamming aggregation; task will self-re-enqueue every 86400 seconds (daily)
    queue.enqueue("app.tasks.ingest_gps_jamming.sync_aggregate_gps_jamming")
    logger.info("Enqueued GPS jamming aggregation job; first run starting now")

    # Enqueue snapshot positions task; self-re-enqueues every 60 seconds
    queue.enqueue("app.tasks.snapshot_positions.sync_snapshot_positions")
    logger.info("Enqueued snapshot positions task; first run starting now")

    # Enqueue GDELT ingest; task will self-re-enqueue every 900 seconds (15 minutes)
    queue.enqueue("app.tasks.ingest_gdelt.sync_ingest_gdelt")
    logger.info("Enqueued GDELT ingest job; first run starting now")

    worker = Worker([queue], connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
