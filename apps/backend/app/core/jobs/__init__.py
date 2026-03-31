"""
JetApi Background Jobs System
Simple in-memory job queue with worker pool.
For production, consider Celery, RQ, or ARQ with Redis.
"""
from app.core.jobs.queue import (
    JobQueue,
    JobStatus,
    JobPriority,
    job_queue,
    get_job_status,
    cancel_job,
)
from app.core.jobs.scheduler import (
    Scheduler,
    scheduler,
    schedule_job,
    schedule_recurring,
)
from app.core.jobs.worker import (
    start_workers,
    stop_workers,
)

__all__ = [
    # Queue
    "JobQueue",
    "JobStatus",
    "JobPriority",
    "job_queue",
    "get_job_status",
    "cancel_job",
    # Scheduler
    "Scheduler",
    "scheduler",
    "schedule_job",
    "schedule_recurring",
    # Worker
    "start_workers",
    "stop_workers",
]
