"""
Admin Routes
Endpoints for monitoring and managing the application.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any

from app.core.config import settings
from app.services.rbac import require_platform_roles
from app.core.cache import cache
from app.core.jobs.queue import job_queue, get_job_status, cancel_job
from app.core.jobs.worker import get_worker_stats
from app.core.jobs.scheduler import scheduler

router = APIRouter(prefix="/admin", tags=["Admin"])


# =============================================================================
# Cache Management
# =============================================================================
@router.get(
    "/cache/stats",
    summary="Get cache statistics",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def get_cache_stats() -> dict[str, Any]:
    """Get current cache statistics."""
    return await cache.get_stats()


@router.delete(
    "/cache",
    summary="Clear cache",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def clear_cache(namespace: str | None = None) -> dict[str, Any]:
    """Clear cache (optionally by namespace)."""
    count = await cache.clear(namespace)
    return {
        "message": f"Cleared {count} cache entries",
        "namespace": namespace or "all",
    }


# =============================================================================
# Job Queue Management
# =============================================================================
@router.get(
    "/jobs/stats",
    summary="Get job queue statistics",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def get_jobs_stats() -> dict[str, Any]:
    """Get current job queue statistics."""
    queue_stats = await job_queue.get_stats()
    worker_stats = await get_worker_stats()
    return {
        "queue": queue_stats,
        "workers": worker_stats,
    }


@router.get(
    "/jobs/{job_id}",
    summary="Get job status",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def get_job(job_id: str) -> dict[str, Any]:
    """Get status of a specific job."""
    job_info = await get_job_status(job_id)
    if not job_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return job_info


@router.delete(
    "/jobs/{job_id}",
    summary="Cancel a job",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def cancel_job_endpoint(job_id: str) -> dict[str, Any]:
    """Cancel a pending job."""
    success = await cancel_job(job_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job cannot be cancelled (not found or not pending)",
        )
    return {"message": "Job cancelled", "job_id": job_id}


@router.post(
    "/jobs/cleanup",
    summary="Clean up old jobs",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def cleanup_jobs(older_than_seconds: int = 3600) -> dict[str, Any]:
    """Remove completed/failed jobs older than specified time."""
    count = await job_queue.clear_completed(older_than_seconds)
    return {"message": f"Cleaned up {count} old jobs"}


# =============================================================================
# Scheduled Jobs Management
# =============================================================================
@router.get(
    "/scheduled",
    summary="List scheduled jobs",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def list_scheduled_jobs() -> list[dict[str, Any]]:
    """Get all scheduled/recurring jobs."""
    return await scheduler.get_jobs()


@router.delete(
    "/scheduled/{job_id}",
    summary="Cancel scheduled job",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def cancel_scheduled_job(job_id: str) -> dict[str, Any]:
    """Cancel a scheduled job."""
    success = await scheduler.cancel(job_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled job not found",
        )
    return {"message": "Scheduled job cancelled", "job_id": job_id}


@router.post(
    "/scheduled/{job_id}/enable",
    summary="Enable scheduled job",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def enable_scheduled_job(job_id: str) -> dict[str, Any]:
    """Enable a scheduled job."""
    success = await scheduler.enable(job_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled job not found",
        )
    return {"message": "Scheduled job enabled", "job_id": job_id}


@router.post(
    "/scheduled/{job_id}/disable",
    summary="Disable scheduled job",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def disable_scheduled_job(job_id: str) -> dict[str, Any]:
    """Disable a scheduled job."""
    success = await scheduler.disable(job_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled job not found",
        )
    return {"message": "Scheduled job disabled", "job_id": job_id}


# =============================================================================
# System Info
# =============================================================================
@router.get(
    "/system",
    summary="Get system information",
    dependencies=[Depends(require_platform_roles("admin"))],
)
async def get_system_info() -> dict[str, Any]:
    """Get system configuration and status."""
    return {
        "project_name": settings.PROJECT_NAME,
        "debug_mode": settings.DEBUG,
        "auth": {"provider": "supabase"},
        "rbac_enabled": settings.ENABLE_RBAC,
        "rate_limiting": {
            "enabled": settings.RATE_LIMIT_ENABLED,
            "requests": settings.RATE_LIMIT_REQUESTS,
            "window_seconds": settings.RATE_LIMIT_WINDOW,
        },
        "caching": {
            "enabled": settings.CACHE_ENABLED,
            "max_size": settings.CACHE_MAX_SIZE,
            "default_ttl": settings.CACHE_DEFAULT_TTL,
        },
        "workers": {
            "count": settings.WORKER_COUNT,
            "queue_max_size": settings.JOB_QUEUE_MAX_SIZE,
        },
    }
