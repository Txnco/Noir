#  JetApi - FastAPI Boilerplate Framework

A production-ready FastAPI boilerplate with built-in authentication, RBAC, database migrations, email service, and type generation for cross-platform development.

##  Features

-  **Unified Authentication** - JWT (local) AND OAuth2 (Google, Auth0, Okta) can run simultaneously
-  **RBAC** - Role-Based Access Control with granular permissions
-  **Email Service** - Dual provider support (SMTP + AWS SES API)
-  **Database Migrations** - Alembic integration with SQLAlchemy
-  **Type Generation** - Export types for TypeScript, Dart/Flutter
-  **Test Suite** - Comprehensive security and auth tests
-  **Background Jobs** - Async job queue with priority and scheduling
-  **Caching** - In-memory cache with TTL and LRU eviction
-  **Rate Limiting** - Token bucket rate limiting per IP/user/endpoint
-  **Security First** - Token hashing, timing attack prevention, account lockout, CORS
-  **API Documentation** - Auto-generated OpenAPI/Swagger docs

##  Project Structure

```
JetApi/
├── app/
│   ├── main.py                 # FastAPI application entry
│   ├── api/v1/routes/          # API route handlers
│   │   ├── auth_routes.py      # Authentication endpoints
│   │   ├── user_routes.py      # User management endpoints
│   │   └── admin_routes.py     # Admin/monitoring endpoints
│   ├── core/
│   │   ├── config.py           # Application settings
│   │   ├── database.py         # SQLAlchemy setup
│   │   ├── logger.py           # Logging with data protection
│   │   ├── cache.py            # In-memory caching
│   │   ├── middleware/         # Request middleware
│   │   │   ├── logging.py      # Request/response logging
│   │   │   └── rate_limit.py   # Rate limiting
│   │   ├── jobs/               # Background jobs system
│   │   │   ├── queue.py        # Job queue
│   │   │   ├── worker.py       # Job workers
│   │   │   └── scheduler.py    # Job scheduler
│   │   ├── email/              # Email service
│   │   │   └── service.py      # SMTP + AWS SES providers
│   │   └── security/           # Auth implementations
│   │       ├── __init__.py     # Unified auth module
│   │       ├── jwt/            # JWT authentication
│   │       └── oauth2/         # OAuth2 authentication
│   ├── models/                 # SQLAlchemy ORM models
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # Business logic (RBAC)
│   ├── seeders/                # Database seeders
│   └── tests/                  # Test suite
├── alembic/                    # Database migrations
├── logs/                       # Application logs
├── scripts/                    # Utility scripts
│   └── generate_types.py       # Type generator
├── generated/                  # Generated type files
├── quick_setup.py              # Setup wizard
├── requirements.txt            # Python dependencies
└── .env.example                # Environment template
```

##  Quick Start (First Time Setup)

### Step 1: Clone the Repository

```bash
git clone <repo-url> JetApi
cd JetApi
```

### Step 2: Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt
```

### Step 3: Configure Environment

**Option A: Quick Setup (SQLite - Default)**

```bash
# Automated setup with SQLite database
python quick_setup.py --quick
```

**Option B: Interactive Setup (Choose your database)**

```bash
# Interactive wizard - choose MySQL, PostgreSQL, or SQLite
python quick_setup.py
```

**Option C: Manual Configuration**

```bash
# 1. Copy the example environment file
cp .env.example .env  # On Windows: copy .env.example .env

# 2. Edit .env and configure your settings
```

**For MySQL Database:**

```env
# Update these in .env file
DATABASE_URL=mysql+mysqlconnector://username:password@localhost:3306/your_database_name

# Example:
DATABASE_URL=mysql+mysqlconnector://root:mypassword@localhost:3306/jetapi_db
```

**For PostgreSQL Database:**

```env
DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name
```

**For SQLite Database (Development):**

```env
DATABASE_URL=sqlite:///./jetapi.db
```

### Step 4: Run Database Migrations

```bash
# Create/update database tables
alembic upgrade head
```

### Step 5: Seed Database (Optional)

```bash
# Create default admin and user accounts
python -m app.seeders.seed_users
```

This creates:
- **Admin**: admin@example.com / Admin123!
- **User**: user@example.com / User123!

### Step 6: Start the Server

```bash
uvicorn app.main:app --reload
```

### Step 7: Access the API

- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

---

##  Common Setup Issues

### "Can't connect to MySQL server"
- Ensure MySQL is running: `systemctl status mysql` (Linux) or check Services (Windows)
- Verify credentials in DATABASE_URL
- Create the database first: `CREATE DATABASE jetapi_db;`

### "Authentication plugin error"
```sql
-- Fix MySQL authentication
ALTER USER 'username'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';
FLUSH PRIVILEGES;
```

### "Module not found" errors
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

### "Migration failed" or "Table already exists"
```bash
# Reset database (WARNING: deletes all data)
alembic downgrade base
alembic upgrade head
```

##  Authentication

JetApi supports **both JWT and OAuth2 simultaneously**. You can enable local authentication, external OAuth2 providers, or both at the same time.

### Configuration

```env
# Enable both authentication methods
ENABLE_LOCAL_AUTH=true    # JWT-based local authentication
ENABLE_OAUTH2=true        # OAuth2/OIDC external providers
```

### JWT Authentication (Local)

When `ENABLE_LOCAL_AUTH=true`, these endpoints are available:

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with token
- `POST /api/v1/auth/verify-email` - Verify email address
- `POST /api/v1/auth/change-password` - Change password (auth required)
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/logout` - Logout (invalidate refresh token)

### OAuth2 Authentication (External Providers)

When `ENABLE_OAUTH2=true`, configure your provider:

```env
OAUTH2_ISSUER=https://accounts.google.com
OAUTH2_AUDIENCE=your-client-id
OAUTH2_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
OAUTH2_AUTO_PROVISION=true  # Auto-create users on first OAuth2 login
```

**Supported Providers:**
- Google
- GitHub
- Microsoft
- Auth0
- Okta
- Any OIDC-compliant provider

### Security Features

| Feature | Description |
|---------|-------------|
| **Token Hashing** | Refresh tokens, password reset tokens, and email verification tokens are hashed (SHA256) before storage |
| **Timing Attack Prevention** | Constant-time comparison prevents user enumeration |
| **Account Lockout** | Automatic lockout after failed login attempts |
| **Auth Rate Limiting** | Per-IP rate limiting on authentication endpoints |
| **Email Verification** | Optional email verification before login |

##  RBAC (Role-Based Access Control)

### Built-in Roles & Permissions

| Role  | Permissions |
|-------|-------------|
| admin | users:read, users:create, users:update, users:delete, roles:*, permissions:* |
| user  | users:read |

### Using RBAC in Routes

```python
from app.services.rbac import require_permissions, require_roles

@router.get("/admin-only")
def admin_endpoint(user = Depends(require_roles("admin"))):
    return {"message": "Admin access granted"}

@router.delete("/users/{id}")
def delete_user(user = Depends(require_permissions("users:delete"))):
    # Only users with users:delete permission can access
    pass
```

##  Type Generation

Generate types for frontend frameworks:

```bash
# Generate all types
python scripts/generate_types.py --all

# Specific formats
python scripts/generate_types.py --typescript  # TypeScript interfaces
python scripts/generate_types.py --dart        # Dart/Flutter classes
python scripts/generate_types.py --json-schema # JSON Schema
python scripts/generate_types.py --openapi     # OpenAPI spec
```

Generated files are placed in `./generated/`:
- `typescript/api-types.ts`
- `dart/api_types.dart`
- `json-schema/schemas.json`
- `openapi/openapi.json`

##  Email Service

JetApi includes a dual-provider email service supporting both SMTP and AWS SES.

### Configuration

```env
# Email sender
EMAIL_FROM=noreply@yourdomain.com

# SMTP Provider
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=true
SMTP_SSL=false

# AWS SES Provider (optional, takes priority if enabled)
AWS_SES_ENABLED=true
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Usage

```python
from app.core.email import (
    send_email,
    send_password_reset_email,
    send_verification_email,
    send_welcome_email,
)

# Send generic email
await send_email(
    to="user@example.com",
    subject="Hello",
    body_html="<p>Welcome!</p>",
    body_text="Welcome!",
)

# Send password reset email (with HTML template)
await send_password_reset_email(
    email="user@example.com",
    token="reset-token-here",
    user_name="John Doe",
)

# Send verification email
await send_verification_email(
    email="user@example.com",
    token="verify-token-here",
    user_name="John Doe",
)

# Send welcome email
await send_welcome_email(
    email="user@example.com",
    user_name="John Doe",
)
```

### Provider Priority

1. **AWS SES** - Used if `AWS_SES_ENABLED=true` and configured
2. **SMTP** - Fallback if SES fails or is not configured

##  Database

### Migrations

```bash
# Run migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"

# Rollback
alembic downgrade -1
```

### Supported Databases

```env
# SQLite (default)
DATABASE_URL=sqlite:///./jetapi.db

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# MySQL
DATABASE_URL=mysql+mysqlconnector://user:pass@localhost:3306/dbname
```

##  Testing

```bash
# Run all tests
pytest app/tests -v

# Run specific test file
pytest app/tests/test_auth.py -v

# Run with coverage
pytest app/tests --cov=app --cov-report=html
```

##  Background Jobs & Queue

Built-in async job queue with priority support:

```python
from app.core.jobs import enqueue_job, JobPriority

# Enqueue a background job
job = await enqueue_job(
    send_email_job,
    "user@example.com",
    "Welcome!",
    priority=JobPriority.HIGH,
)

# Schedule job for later
from app.core.jobs import schedule_job
await schedule_job(cleanup_task, delay_seconds=3600)

# Recurring jobs
from app.core.jobs import schedule_recurring
await schedule_recurring(daily_report, interval_seconds=86400)
```

Admin endpoints for job management:
- `GET /api/v1/admin/jobs/stats` - Queue statistics
- `GET /api/v1/admin/jobs/{id}` - Job status
- `DELETE /api/v1/admin/jobs/{id}` - Cancel job
- `GET /api/v1/admin/scheduled` - List scheduled jobs

##  Caching

In-memory cache with TTL and LRU eviction:

```python
from app.core.cache import cache, cached

# Direct cache operations
await cache.set("key", {"data": "value"}, ttl=60)
value = await cache.get("key")

# Decorator for automatic caching
@cached(ttl=300, namespace="users")
async def get_user_profile(user_id: int):
    # Expensive operation...
    return user_data
```

Admin endpoints:
- `GET /api/v1/admin/cache/stats` - Cache statistics
- `DELETE /api/v1/admin/cache` - Clear cache

##  Rate Limiting

Token bucket rate limiting per IP/user:

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60  # seconds
```

Route-specific rate limiting:

```python
from app.core.middleware.rate_limit import rate_limit

@router.post("/expensive-operation")
async def expensive_op(_: None = Depends(rate_limit(requests=5, window=60))):
    ...
```

##  Logging

Comprehensive logging with sensitive data protection:

- **General logs**: `logs/jetapi.log` - Human-readable format
- **Error logs**: `logs/errors.log` - Errors and exceptions
- **Access logs**: `logs/access.log` - Apache/Nginx combined format
- **JSON logs**: `logs/jetapi.json.log` - For log aggregation
- **Security logs**: `logs/security.log` - Auth events

Automatic redaction of:
- Passwords
- Tokens (access, refresh, API keys)
- Authorization headers
- Credit card patterns
- SSN patterns

##  Configuration

All settings are in `.env`. Key options:

```env
# ===================
# Core Settings
# ===================
PROJECT_NAME=JetApi
DEBUG=true
SECRET_KEY=your-secret-key

# ===================
# Database
# ===================
DATABASE_URL=sqlite:///./jetapi.db

# ===================
# Authentication
# ===================
# Enable authentication methods (can enable both)
ENABLE_LOCAL_AUTH=true
ENABLE_OAUTH2=false

# JWT Settings
JWT_SECRET_KEY=your-jwt-secret  # REQUIRED in production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# OAuth2 Settings (if ENABLE_OAUTH2=true)
OAUTH2_ISSUER=https://accounts.google.com
OAUTH2_AUDIENCE=your-client-id
OAUTH2_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
OAUTH2_AUTO_PROVISION=true

# ===================
# Security
# ===================
# Auth Rate Limiting
AUTH_RATE_LIMIT_ATTEMPTS=5
AUTH_RATE_LIMIT_WINDOW=300  # seconds

# Email Verification
REQUIRE_EMAIL_VERIFICATION=false

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_DIGIT=true

# ===================
# Email Service
# ===================
EMAIL_FROM=noreply@yourdomain.com

# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_TLS=true
SMTP_SSL=false

# AWS SES Settings (optional)
AWS_SES_ENABLED=false
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# ===================
# RBAC
# ===================
ENABLE_RBAC=true

# ===================
# Rate Limiting
# ===================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# ===================
# Caching
# ===================
CACHE_DEFAULT_TTL=300
CACHE_MAX_SIZE=1000
```

##  Development

### Adding New Routes

1. Create route file in `app/api/v1/routes/`
2. Import and include in `app/main.py`
3. Add tests in `app/tests/`

### Adding New Models

1. Create model in `app/models/`
2. Create schema in `app/schemas/`
3. Create migration: `alembic revision --autogenerate -m "add model"`
4. Apply: `alembic upgrade head`

##  Architecture

| Layer   | Location           | Purpose                              |
|---------|-------------------|--------------------------------------|
| Routes  | `app/api/v1/routes/` | API endpoint definitions           |
| Schemas | `app/schemas/`      | Request/response validation         |
| Models  | `app/models/`       | Database table definitions          |
| Services| `app/services/`     | Business logic (RBAC, etc.)         |
| Core    | `app/core/`         | Config, database, security, email   |

##  Security Best Practices

JetApi implements production-grade security:

| Feature | Implementation |
|---------|----------------|
| **Password Hashing** | bcrypt with random salt |
| **Token Storage** | SHA256 hashing (refresh, reset, verification tokens) |
| **Timing Attacks** | Constant-time comparison on all auth checks |
| **Account Lockout** | Configurable lockout after failed attempts |
| **Rate Limiting** | Per-IP and per-endpoint limits |
| **JWT Security** | Short-lived access tokens, secure refresh rotation |
| **CORS** | Configurable allowed origins |
| **Input Validation** | Pydantic schemas on all endpoints |
| **SQL Injection** | SQLAlchemy ORM with parameterized queries |
| **Sensitive Data** | Automatic log redaction of passwords/tokens |

### Production Checklist

- [ ] Set `DEBUG=false`
- [ ] Set strong `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Configure proper `CORS_ORIGINS`
- [ ] Enable `REQUIRE_EMAIL_VERIFICATION=true`
- [ ] Set up rate limiting
- [ ] Use PostgreSQL instead of SQLite
- [ ] Configure email service for password resets
- [ ] Review and adjust `AUTH_RATE_LIMIT_*` settings

##  License

MIT License

---

Built with  using FastAPI
