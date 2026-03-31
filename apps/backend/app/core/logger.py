"""
JetApi Logging System
Comprehensive logging with separate files for access, errors, and general logs.
Protects sensitive data through automatic redaction.
"""
import logging
import logging.handlers
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from contextvars import ContextVar

from app.core.config import settings


# =============================================================================
# Context Variables for Request Tracking
# =============================================================================
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_ctx: ContextVar[Optional[str]] = ContextVar("user_id", default=None)


# =============================================================================
# Sensitive Data Patterns for Redaction
# =============================================================================
SENSITIVE_PATTERNS = [
    # Passwords
    (re.compile(r'("password"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'("current_password"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'("new_password"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'("hashed_password"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'(password=)[^\s&]+', re.IGNORECASE), r'\1[REDACTED]'),
    
    # Tokens & Secrets
    (re.compile(r'("access_token"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'("refresh_token"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'("token"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'("secret"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'("api_key"\s*:\s*")[^"]*(")', re.IGNORECASE), r'\1[REDACTED]\2'),
    (re.compile(r'(Bearer\s+)[^\s]+', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(Authorization:\s*)[^\s]+', re.IGNORECASE), r'\1[REDACTED]'),
    
    # Credit Cards (basic pattern)
    (re.compile(r'\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?)\d{4}\b'), r'\1****'),
    
    # SSN patterns
    (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), r'***-**-****'),
]


def redact_sensitive_data(message: str) -> str:
    """Redact sensitive data from log messages."""
    if not message:
        return message
    
    result = str(message)
    for pattern, replacement in SENSITIVE_PATTERNS:
        result = pattern.sub(replacement, result)
    
    return result


# =============================================================================
# Custom Log Formatters
# =============================================================================
class HumanReadableFormatter(logging.Formatter):
    """
    Human-readable log format for console and general logs.
    Easy to read with clear structure.
    """
    
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m',      # Reset
    }
    
    def __init__(self, use_colors: bool = True):
        super().__init__()
        self.use_colors = use_colors and sys.stdout.isatty()
    
    def format(self, record: logging.LogRecord) -> str:
        # Get context
        request_id = request_id_ctx.get() or "-"
        user_id = user_id_ctx.get() or "anonymous"
        
        # Format timestamp
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        
        # Level with optional color
        level = record.levelname
        if self.use_colors:
            color = self.COLORS.get(level, self.COLORS['RESET'])
            reset = self.COLORS['RESET']
            level_str = f"{color}{level:8}{reset}"
        else:
            level_str = f"{level:8}"
        
        # Build message
        message = redact_sensitive_data(record.getMessage())
        
        # Format: TIMESTAMP | LEVEL | REQUEST_ID | USER | LOGGER | MESSAGE
        log_line = f"{timestamp} | {level_str} | {request_id[:8]:8} | {user_id[:12]:12} | {record.name:20} | {message}"
        
        # Add exception info if present
        if record.exc_info:
            exc_text = self.formatException(record.exc_info)
            log_line += f"\n{redact_sensitive_data(exc_text)}"
        
        return log_line


class JSONFormatter(logging.Formatter):
    """
    JSON log format for structured logging and log aggregation systems.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive_data(record.getMessage()),
            "request_id": request_id_ctx.get(),
            "user_id": user_id_ctx.get(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": redact_sensitive_data(self.formatException(record.exc_info)),
            }
        
        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in ('name', 'msg', 'args', 'created', 'filename', 'funcName',
                          'levelname', 'levelno', 'lineno', 'module', 'msecs',
                          'pathname', 'process', 'processName', 'relativeCreated',
                          'stack_info', 'exc_info', 'exc_text', 'thread', 'threadName',
                          'message', 'taskName'):
                log_data[key] = redact_sensitive_data(str(value)) if value else value
        
        return json.dumps(log_data, default=str)


class AccessLogFormatter(logging.Formatter):
    """
    Access log format similar to Apache/Nginx combined log format.
    Easy to parse and analyze.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        # Expected extra fields: client_ip, method, path, status_code, response_time, user_agent
        timestamp = datetime.now(timezone.utc).strftime("%d/%b/%Y:%H:%M:%S %z")
        
        client_ip = getattr(record, 'client_ip', '-')
        method = getattr(record, 'method', '-')
        path = getattr(record, 'path', '-')
        status_code = getattr(record, 'status_code', '-')
        response_time = getattr(record, 'response_time_ms', '-')
        user_agent = getattr(record, 'user_agent', '-')
        request_id = request_id_ctx.get() or "-"
        user_id = user_id_ctx.get() or "-"
        
        # Format: IP - USER [TIMESTAMP] "METHOD PATH" STATUS RESPONSE_TIME "USER_AGENT" REQUEST_ID
        return (
            f'{client_ip} - {user_id} [{timestamp}] '
            f'"{method} {redact_sensitive_data(path)}" {status_code} {response_time}ms '
            f'"{user_agent}" {request_id}'
        )


# =============================================================================
# Log Directory Setup
# =============================================================================
def ensure_log_directory() -> Path:
    """Ensure log directory exists."""
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    return log_dir


# =============================================================================
# Logger Setup
# =============================================================================
def setup_logging() -> None:
    """Configure all loggers for the application."""
    log_dir = ensure_log_directory()
    
    # Determine log level
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    
    # =========================
    # Root Logger Configuration
    # =========================
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # =========================
    # Console Handler
    # =========================
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(HumanReadableFormatter(use_colors=True))
    root_logger.addHandler(console_handler)
    
    # =========================
    # General Log File (Rotating)
    # =========================
    general_handler = logging.handlers.RotatingFileHandler(
        log_dir / "jetapi.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    general_handler.setLevel(log_level)
    general_handler.setFormatter(HumanReadableFormatter(use_colors=False))
    root_logger.addHandler(general_handler)
    
    # =========================
    # Error Log File (Separate)
    # =========================
    error_handler = logging.handlers.RotatingFileHandler(
        log_dir / "errors.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=10,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(HumanReadableFormatter(use_colors=False))
    root_logger.addHandler(error_handler)
    
    # =========================
    # JSON Log File (For log aggregation)
    # =========================
    json_handler = logging.handlers.RotatingFileHandler(
        log_dir / "jetapi.json.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    json_handler.setLevel(log_level)
    json_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(json_handler)
    
    # =========================
    # Access Log (Separate logger)
    # =========================
    access_logger = logging.getLogger("jetapi.access")
    access_logger.setLevel(logging.INFO)
    access_logger.propagate = False  # Don't propagate to root
    
    access_handler = logging.handlers.TimedRotatingFileHandler(
        log_dir / "access.log",
        when="midnight",
        interval=1,
        backupCount=30,  # Keep 30 days
        encoding="utf-8",
    )
    access_handler.setFormatter(AccessLogFormatter())
    access_logger.addHandler(access_handler)
    
    # Also log access to console in debug mode
    if settings.DEBUG:
        access_console = logging.StreamHandler(sys.stdout)
        access_console.setFormatter(AccessLogFormatter())
        access_logger.addHandler(access_console)
    
    # =========================
    # Security Log (Separate)
    # =========================
    security_logger = logging.getLogger("jetapi.security")
    security_logger.setLevel(logging.INFO)
    
    security_handler = logging.handlers.RotatingFileHandler(
        log_dir / "security.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=30,
        encoding="utf-8",
    )
    security_handler.setFormatter(HumanReadableFormatter(use_colors=False))
    security_logger.addHandler(security_handler)
    
    # =========================
    # Suppress noisy loggers
    # =========================
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


# =============================================================================
# Logger Getters
# =============================================================================
def get_logger(name: str = "jetapi") -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)


def get_access_logger() -> logging.Logger:
    """Get the access logger."""
    return logging.getLogger("jetapi.access")


def get_security_logger() -> logging.Logger:
    """Get the security logger for auth events."""
    return logging.getLogger("jetapi.security")


# =============================================================================
# Convenience Functions
# =============================================================================
def log_security_event(
    event_type: str,
    message: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    **extra
) -> None:
    """Log a security-related event."""
    security_logger = get_security_logger()
    extra_info = {
        "event_type": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
        **extra
    }
    security_logger.info(f"[{event_type}] {message} | {extra_info}")


def log_access(
    client_ip: str,
    method: str,
    path: str,
    status_code: int,
    response_time_ms: float,
    user_agent: str = "-",
) -> None:
    """Log an access event."""
    access_logger = get_access_logger()
    access_logger.info(
        "",
        extra={
            "client_ip": client_ip,
            "method": method,
            "path": path,
            "status_code": status_code,
            "response_time_ms": round(response_time_ms, 2),
            "user_agent": user_agent,
        }
    )


# =============================================================================
# Default Logger Instance
# =============================================================================
logger = get_logger("jetapi")
