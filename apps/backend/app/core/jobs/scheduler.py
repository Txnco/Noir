"""
Job Scheduler Implementation
Schedule jobs to run at specific times or intervals.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Callable, Coroutine, Optional
from dataclasses import dataclass, field
import uuid

from app.core.logger import get_logger
from app.core.jobs.queue import job_queue, JobPriority

logger = get_logger("jetapi.jobs.scheduler")


@dataclass
class ScheduledJob:
    """Represents a scheduled or recurring job."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    func: Callable[..., Coroutine] = None
    args: tuple = field(default_factory=tuple)
    kwargs: dict = field(default_factory=dict)
    priority: JobPriority = JobPriority.NORMAL
    
    # Scheduling
    interval_seconds: Optional[float] = None  # For recurring jobs
    next_run: Optional[datetime] = None
    last_run: Optional[datetime] = None
    
    # State
    enabled: bool = True
    run_count: int = 0
    max_runs: Optional[int] = None  # None = unlimited
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "priority": self.priority.name,
            "interval_seconds": self.interval_seconds,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "enabled": self.enabled,
            "run_count": self.run_count,
            "max_runs": self.max_runs,
        }


class Scheduler:
    """
    Job scheduler for running jobs at specific times or intervals.
    
    Features:
    - One-time scheduled jobs
    - Recurring jobs with intervals
    - Job management (enable/disable/remove)
    """
    
    def __init__(self):
        self._scheduled_jobs: dict[str, ScheduledJob] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
    
    async def start(self) -> None:
        """Start the scheduler."""
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("Scheduler started")
    
    async def stop(self) -> None:
        """Stop the scheduler."""
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        logger.info("Scheduler stopped")
    
    async def schedule_at(
        self,
        func: Callable[..., Coroutine],
        run_at: datetime,
        *args,
        name: Optional[str] = None,
        priority: JobPriority = JobPriority.NORMAL,
        **kwargs,
    ) -> ScheduledJob:
        """Schedule a job to run at a specific time."""
        async with self._lock:
            job = ScheduledJob(
                name=name or func.__name__,
                func=func,
                args=args,
                kwargs=kwargs,
                priority=priority,
                next_run=run_at,
                max_runs=1,
            )
            
            self._scheduled_jobs[job.id] = job
            logger.info(f"Scheduled job '{job.name}' for {run_at.isoformat()}")
            
            return job
    
    async def schedule_in(
        self,
        func: Callable[..., Coroutine],
        delay_seconds: float,
        *args,
        name: Optional[str] = None,
        priority: JobPriority = JobPriority.NORMAL,
        **kwargs,
    ) -> ScheduledJob:
        """Schedule a job to run after a delay."""
        run_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        return await self.schedule_at(
            func,
            run_at,
            *args,
            name=name,
            priority=priority,
            **kwargs,
        )
    
    async def schedule_recurring(
        self,
        func: Callable[..., Coroutine],
        interval_seconds: float,
        *args,
        name: Optional[str] = None,
        priority: JobPriority = JobPriority.LOW,
        start_immediately: bool = False,
        max_runs: Optional[int] = None,
        **kwargs,
    ) -> ScheduledJob:
        """Schedule a recurring job."""
        async with self._lock:
            if start_immediately:
                next_run = datetime.now(timezone.utc)
            else:
                next_run = datetime.now(timezone.utc) + timedelta(seconds=interval_seconds)
            
            job = ScheduledJob(
                name=name or func.__name__,
                func=func,
                args=args,
                kwargs=kwargs,
                priority=priority,
                interval_seconds=interval_seconds,
                next_run=next_run,
                max_runs=max_runs,
            )
            
            self._scheduled_jobs[job.id] = job
            logger.info(
                f"Scheduled recurring job '{job.name}' "
                f"every {interval_seconds}s"
            )
            
            return job
    
    async def cancel(self, job_id: str) -> bool:
        """Cancel a scheduled job."""
        async with self._lock:
            if job_id in self._scheduled_jobs:
                del self._scheduled_jobs[job_id]
                logger.info(f"Cancelled scheduled job: {job_id}")
                return True
            return False
    
    async def enable(self, job_id: str) -> bool:
        """Enable a scheduled job."""
        async with self._lock:
            if job_id in self._scheduled_jobs:
                self._scheduled_jobs[job_id].enabled = True
                return True
            return False
    
    async def disable(self, job_id: str) -> bool:
        """Disable a scheduled job."""
        async with self._lock:
            if job_id in self._scheduled_jobs:
                self._scheduled_jobs[job_id].enabled = False
                return True
            return False
    
    async def get_jobs(self) -> list[dict]:
        """Get all scheduled jobs."""
        async with self._lock:
            return [job.to_dict() for job in self._scheduled_jobs.values()]
    
    async def _run(self) -> None:
        """Main scheduler loop."""
        while self._running:
            try:
                now = datetime.now(timezone.utc)
                jobs_to_run: list[ScheduledJob] = []
                
                async with self._lock:
                    for job in self._scheduled_jobs.values():
                        if (
                            job.enabled
                            and job.next_run
                            and job.next_run <= now
                            and (job.max_runs is None or job.run_count < job.max_runs)
                        ):
                            jobs_to_run.append(job)
                
                # Enqueue due jobs
                for job in jobs_to_run:
                    await job_queue.enqueue(
                        job.func,
                        *job.args,
                        name=f"scheduled:{job.name}",
                        priority=job.priority,
                        **job.kwargs,
                    )
                    
                    job.last_run = now
                    job.run_count += 1
                    
                    # Update next run time
                    if job.interval_seconds:
                        job.next_run = now + timedelta(seconds=job.interval_seconds)
                    else:
                        job.next_run = None
                    
                    # Remove one-time jobs that have completed
                    if job.max_runs and job.run_count >= job.max_runs:
                        async with self._lock:
                            if job.id in self._scheduled_jobs:
                                del self._scheduled_jobs[job.id]
                
                # Sleep before next check
                await asyncio.sleep(1)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(1)


# Global scheduler instance
scheduler = Scheduler()


# =============================================================================
# Convenience Functions
# =============================================================================
async def schedule_job(
    func: Callable[..., Coroutine],
    delay_seconds: float,
    *args,
    **kwargs,
) -> ScheduledJob:
    """Schedule a job to run after a delay."""
    return await scheduler.schedule_in(
        func,
        delay_seconds,
        *args,
        **kwargs,
    )


async def schedule_recurring(
    func: Callable[..., Coroutine],
    interval_seconds: float,
    *args,
    **kwargs,
) -> ScheduledJob:
    """Schedule a recurring job."""
    return await scheduler.schedule_recurring(
        func,
        interval_seconds,
        *args,
        **kwargs,
    )
