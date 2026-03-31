"""
Gunicorn Configuration for Production
Run: gunicorn app.main:app -c gunicorn.conf.py
"""
import multiprocessing

# Server socket
bind = "0.0.0.0:8000"

# Worker processes: 2 * CPU cores + 1
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000

# Timeouts
timeout = 30
keepalive = 5
graceful_timeout = 30

# Restart workers to prevent memory leaks
max_requests = 1000
max_requests_jitter = 100

# Preload app for copy-on-write memory savings
preload_app = True

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Process naming
proc_name = "jetapi"
