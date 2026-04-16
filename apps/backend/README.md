# Noir Backend - JetApi Framework

A production-ready FastAPI backend for the Noir business ticketing system, integrated with Supabase and featuring advanced RBAC, UUID identification, and native security.

## 🚀 Features

- **Unified Authentication** - Supports local JWT and Supabase JWT simultaneously.
- **Native Security** - High-performance password hashing using the native `bcrypt` library.
- **UUID Identification** - Modern system-wide identification (PostgreSQL UUID) for Users, Events, and Organizations.
- **RBAC** - Granular Role-Based Access Control with hierarchical permissions.
- **Noir Business Logic** - Built-in models and routes for Organizations, Venues, Events, and Discovery feeds.
- **Database Migrations** - Robust Alembic integration tailored for Supabase/PostgreSQL.
- **Type Generation** - Automatic export of Pydantic schemas to TypeScript and Dart.
- **Async Architecture** - Fully asynchronous database operations and background job processing.

## 🏗️ Project Structure

```
app/
├── api/v1/routes/          # Route handlers (auth, user, noir, admin)
├── core/                   # Core logic (security, database, config, jobs)
│   └── security/           # Unified Auth (Local + Supabase)
├── models/                 # SQLAlchemy ORM models (Noir + Core)
├── schemas/                # Pydantic validation models
├── seeders/                # Database population scripts
└── tests/                  # Integration and unit tests
alembic/                    # Database migration versions
scripts/                    # Utility scripts (type generation)
```

## 🛠️ Setup & Installation

### 1. Install Dependencies
```bash
# Recommended: use a virtual environment
pip install -r requirements.txt
```

### 2. Environment Configuration
Create a `.env` file based on `.env.example`:
```env
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql+asyncpg://postgres:[password]@db.[project-id].supabase.co:5432/postgres

# Security
SECRET_KEY=your-32-char-secret-key
JWT_SECRET_KEY=your-32-char-jwt-secret
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Auth Toggles
ENABLE_LOCAL_AUTH=true
ENABLE_SUPABASE_AUTH=true
```

### 3. Database Migrations
Initialize your Supabase database schema:
```bash
# Apply all migrations to the Supabase instance
alembic upgrade head
```

### 4. Seed Initial Data
```bash
# Seed Core RBAC & Users
python -m app.seeders.seed_users

# Seed Noir Organizations & Events (for Discovery test)
python -m app.seeders.seed_noir
```

## 🚀 Running the Server

```bash
# Start with auto-reload for development
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **API Documentation**: http://localhost:8000/docs
- **Noir Discovery Feed**: `GET /api/v1/noir/events`

## 🔐 Authentication

### Local Authentication
Uses the `bcrypt` library for secure hashing.
- `POST /api/v1/auth/login`
- `POST /api/v1/users` (Registration)

### Supabase Authentication
Enabled by setting `ENABLE_SUPABASE_AUTH=true`. The system will automatically validate JWTs issued by your Supabase project.

## 👥 RBAC Roles

| Role  | Description |
|-------|-------------|
| admin | Full system access |
| user  | Standard customer access |

## 📦 Type Generation
Synchronize your frontend models with the backend:
```bash
python scripts/generate_types.py --typescript
```

## 🧪 Testing
```bash
export PYTHONPATH=$PYTHONPATH:.
pytest app/tests/test_auth.py -v
```

## 📝 License
MIT License
