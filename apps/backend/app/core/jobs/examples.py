"""
Example Background Jobs
Demonstrates how to use the jobs system for common tasks.
"""
from datetime import datetime, timezone
from typing import Optional

from app.core.jobs import (
    enqueue_job,
    schedule_job,
    schedule_recurring,
    JobPriority,
)
from app.core.cache import cache, cached, invalidate_cache
from app.core.logger import get_logger, log_security_event

logger = get_logger("jetapi.jobs.examples")


# =============================================================================
# Example Background Jobs
# =============================================================================

async def send_email_job(
    to: str,
    subject: str,
    body: str,
    cc: Optional[list[str]] = None,
) -> dict:
    """
    Example: Send email in background.
    This would integrate with your email service.
    """
    logger.info(f"Sending email to {to}: {subject}")
    
    # Simulate email sending
    import asyncio
    await asyncio.sleep(1)  # Simulate I/O
    
    # In production, integrate with:
    # - SendGrid
    # - AWS SES
    # - Mailgun
    # - etc.
    
    return {
        "sent_to": to,
        "subject": subject,
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }


async def send_welcome_email(user_email: str, user_name: str) -> dict:
    """Send welcome email to new user."""
    return await send_email_job(
        to=user_email,
        subject="Welcome to JetApi!",
        body=f"Hello {user_name}, welcome to our platform!",
    )


async def send_password_reset_email(user_email: str, reset_url: str) -> dict:
    """Send password reset email."""
    return await send_email_job(
        to=user_email,
        subject="Password Reset Request",
        body=f"Click here to reset your password: {reset_url}",
    )


async def cleanup_expired_tokens() -> dict:
    """
    Example: Cleanup expired tokens from database.
    Good for recurring scheduled jobs.
    """
    logger.info("Cleaning up expired tokens...")
    
    # In production:
    # from app.core.database import get_db
    # from app.models.user import User
    # from datetime import datetime, timedelta
    #
    # async with get_db() as db:
    #     cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    #     result = await db.execute(
    #         User.__table__.update()
    #         .where(User.password_reset_expires < cutoff)
    #         .values(password_reset_token=None, password_reset_expires=None)
    #     )
    #     await db.commit()
    
    return {
        "task": "cleanup_expired_tokens",
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


async def sync_external_data(source: str) -> dict:
    """
    Example: Sync data from external API.
    """
    logger.info(f"Syncing data from {source}...")
    
    import asyncio
    await asyncio.sleep(2)  # Simulate API call
    
    return {
        "source": source,
        "records_synced": 100,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


async def generate_report(report_type: str, user_id: int) -> dict:
    """
    Example: Generate a report in background.
    """
    logger.info(f"Generating {report_type} report for user {user_id}")
    
    import asyncio
    await asyncio.sleep(5)  # Simulate heavy processing
    
    return {
        "report_type": report_type,
        "user_id": user_id,
        "file_url": f"/reports/{report_type}_{user_id}.pdf",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def notify_user(user_id: int, message: str, channel: str = "email") -> dict:
    """
    Example: Send notification to user.
    """
    logger.info(f"Notifying user {user_id} via {channel}: {message}")
    
    import asyncio
    await asyncio.sleep(0.5)
    
    return {
        "user_id": user_id,
        "channel": channel,
        "status": "sent",
    }


# =============================================================================
# Usage Examples
# =============================================================================

async def example_enqueue_jobs():
    """Examples of enqueueing jobs."""
    
    # Simple job
    job = await enqueue_job(
        send_welcome_email,
        "user@example.com",
        "John Doe",
    )
    print(f"Enqueued job: {job.id}")
    
    # High priority job
    urgent_job = await enqueue_job(
        send_password_reset_email,
        "user@example.com",
        "https://example.com/reset?token=abc123",
        priority=JobPriority.HIGH,
    )
    print(f"Enqueued urgent job: {urgent_job.id}")
    
    # Job with custom name and retries
    report_job = await enqueue_job(
        generate_report,
        "monthly_sales",
        user_id=123,
        name="generate-monthly-report",
        priority=JobPriority.LOW,
        max_retries=5,
        timeout=300,  # 5 minute timeout
    )
    print(f"Enqueued report job: {report_job.id}")


async def example_scheduled_jobs():
    """Examples of scheduling jobs."""
    
    # Schedule job to run in 5 minutes
    scheduled = await schedule_job(
        send_email_job,
        delay_seconds=300,
        to="user@example.com",
        subject="Reminder",
        body="Don't forget to complete your profile!",
    )
    print(f"Scheduled job: {scheduled.id}")
    
    # Recurring job: cleanup every hour
    recurring = await schedule_recurring(
        cleanup_expired_tokens,
        interval_seconds=3600,
        name="hourly-token-cleanup",
        start_immediately=False,
    )
    print(f"Recurring job: {recurring.id}")
    
    # Recurring job: sync data every 15 minutes
    sync_job = await schedule_recurring(
        sync_external_data,
        900,  # interval_seconds
        "external-api",  # positional arg for sync_external_data
        name="data-sync",
    )
    print(f"Sync job: {sync_job.id}")


# =============================================================================
# Example Cached Functions
# =============================================================================

@cached(ttl=300, namespace="users")
async def get_user_profile(user_id: int) -> dict:
    """
    Example: Cached user profile fetch.
    Result is cached for 5 minutes.
    """
    logger.info(f"Fetching user profile for {user_id} (cache miss)")
    
    # In production:
    # async with get_db() as db:
    #     user = await db.get(User, user_id)
    #     return user.to_dict()
    
    return {
        "id": user_id,
        "name": "John Doe",
        "email": "john@example.com",
    }


@cached(ttl=3600, namespace="settings")
async def get_app_settings() -> dict:
    """
    Example: Cached application settings.
    Cached for 1 hour.
    """
    logger.info("Fetching app settings (cache miss)")
    return {
        "theme": "dark",
        "language": "en",
        "features": ["feature1", "feature2"],
    }


@cached(ttl=60, namespace="stats", key_builder=lambda period: f"stats_{period}")
async def get_dashboard_stats(period: str = "day") -> dict:
    """
    Example: Cached dashboard statistics.
    Cached for 1 minute with custom key.
    """
    logger.info(f"Computing stats for {period} (cache miss)")
    return {
        "period": period,
        "users": 1000,
        "orders": 500,
        "revenue": 50000,
    }


async def example_cache_usage():
    """Examples of using the cache."""
    
    # Direct cache operations
    await cache.set("my-key", {"data": "value"}, ttl=60)
    value = await cache.get("my-key")
    print(f"Cache value: {value}")
    
    # Using cached decorator
    profile1 = await get_user_profile(123)  # Cache miss
    profile2 = await get_user_profile(123)  # Cache hit
    
    # Invalidate cache
    await invalidate_cache("users")  # Clear all user caches
    
    # Get cache stats
    stats = await cache.get_stats()
    print(f"Cache stats: {stats}")
