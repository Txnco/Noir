from datetime import datetime
from enum import Enum
import uuid
from typing import Any, Callable, Coroutine, Optional

from arq import create_pool
from arq.connections import RedisSettings

from app.core.logger import get_logger
from app.core.config import settings

logger = get_logger('jetapi.jobs.queue')

class JobStatus(str, Enum):
    PENDING = 'pending'
    RUNNING = 'running'
    COMPLETED = 'completed'
    FAILED = 'failed'
    CANCELLED = 'cancelled'
    RETRYING = 'retrying'

class JobPriority(int, Enum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3

_pool = None

async def get_arq_pool():
    global _pool
    if _pool is None:
        redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
        try:
            _pool = await create_pool(RedisSettings.from_dsn(redis_url))
        except Exception as e:
            logger.warning(f'Arq initialization failed: {e}')
    return _pool

class JobQueue:
    async def enqueue(self, func: Callable, *args, name: Optional[str] = None, priority: JobPriority = JobPriority.NORMAL, max_retries: int = 3, retry_delay: float = 1.0, timeout: Optional[float] = None, scheduled_at: Optional[datetime] = None, **kwargs) -> Any:
        pool = await get_arq_pool()
        func_name = name or getattr(func, '__name__', 'unknown')
        
        class MockJob:
            def __init__(self, job_id):
                self.id = job_id
                self.status = JobStatus.PENDING
                
        if not pool:
            return MockJob(str(uuid.uuid4()))
            
        job = await pool.enqueue_job(func_name, *args, _defer_until=scheduled_at, **kwargs)
        return MockJob(job.job_id) if job else MockJob(str(uuid.uuid4()))

    async def dequeue(self):
        return None  # Arq handles this internally

    async def get_stats(self):
        return {'backend': 'arq', 'status': 'connected' if _pool else 'disconnected'}
        
    async def clear_completed(self, _: int):
        return 0

job_queue = JobQueue()

async def get_job_status(job_id: str) -> dict:
    return {'id': job_id, 'status': 'unknown'}

async def cancel_job(job_id: str) -> bool:
    return False
