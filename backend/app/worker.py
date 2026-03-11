import os

from redis import Redis
from rq import Queue, Worker


def main() -> None:
    """Start the RQ worker and enqueue the first satellite ingest immediately.

    The ingest job self-re-enqueues every 2 hours via the self-re-enqueue
    pattern inside sync_fetch_and_upsert_satellites.
    """
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    conn = Redis.from_url(redis_url)
    queue = Queue(connection=conn)

    # Enqueue first run immediately; job will self-re-enqueue every 2 hours
    queue.enqueue("app.tasks.ingest_satellites.sync_fetch_and_upsert_satellites")

    worker = Worker([queue], connection=conn)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()
