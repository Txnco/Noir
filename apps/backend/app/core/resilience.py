"""
Resilience Patterns
Circuit breaker + retry with exponential backoff for external service calls.
"""
import pybreaker
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import httpx
import logging

from app.core.logger import get_logger

logger = get_logger("jetapi.resilience")


# =============================================================================
# Circuit Breaker (for external service calls)
# =============================================================================
# Opens after 5 consecutive failures, tries again after 30 seconds
external_service_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=30,
    name="external_service",
)

db_breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=15,
    name="database",
)


# =============================================================================
# Retry Decorators
# =============================================================================
def retry_external_call(max_attempts: int = 3, min_wait: int = 1, max_wait: int = 10):
    """
    Retry decorator for external HTTP calls with exponential backoff.

    Usage:
        @retry_external_call(max_attempts=3)
        async def call_payment_api(data):
            async with httpx.AsyncClient() as client:
                return await client.post(url, json=data)
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((
            httpx.ConnectError,
            httpx.TimeoutException,
            httpx.ReadTimeout,
            ConnectionError,
            TimeoutError,
        )),
        before_sleep=before_sleep_log(logging.getLogger("jetapi.resilience"), logging.WARNING),
        reraise=True,
    )


# =============================================================================
# HTTP Client Factory with Timeouts
# =============================================================================
def create_http_client(
    connect_timeout: float = 5.0,
    read_timeout: float = 30.0,
    write_timeout: float = 10.0,
    pool_timeout: float = 10.0,
) -> httpx.AsyncClient:
    """
    Create an httpx AsyncClient with production timeouts.

    Usage:
        async with create_http_client() as client:
            response = await client.get(url)
    """
    return httpx.AsyncClient(
        timeout=httpx.Timeout(
            connect=connect_timeout,
            read=read_timeout,
            write=write_timeout,
            pool=pool_timeout,
        ),
        follow_redirects=True,
    )
