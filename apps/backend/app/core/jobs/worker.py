import asyncio
from typing import Optional

from app.core.logger import get_logger

logger = get_logger('jetapi.jobs.worker')

# Arq uses standard worker settings
class WorkerSettings:
    functions = []
    redis_settings = None

async def start_workers(count: int = 4) -> None:
    logger.info('Arq: Run arq app.core.jobs.worker.WorkerSettings instead of local workers')

async def stop_workers() -> None:
    logger.info('Arq backend handles worker stopping externally')

async def get_worker_stats() -> dict:
    return {'backend': 'arq', 'worker_count': 'Check Arq'}

