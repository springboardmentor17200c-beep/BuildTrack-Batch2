# BuildTrack Backend Notes

These notes explain the current backend setup, how the folders fit together, and what to work on next.

## 1. What We Built

The backend is a Python FastAPI API for the BuildTrack construction project management platform.

Current backend stack:

- FastAPI: creates API endpoints.
- Uvicorn: runs the FastAPI server.
- MongoDB: stores users, projects, workers, inventory, resources, procurement, notifications, and reports.
- Motor: async MongoDB driver for Python.
- Pydantic and Pydantic Settings: validate request/response data and load environment variables from `.env`.
- PyJWT: creates and verifies JWT login tokens.
- pwdlib: hashes passwords securely.
- Pytest: tests the backend.
- Ruff: checks code style and catches common mistakes.

## 2. Backend Folder Structure

```text
backend/
  app/
    api/
      router.py
    core/
      config.py
      security.py
    db/
      mongodb.py
    modules/
      auth/
        router.py
        models.py
        db.py
      frontend_data/
        router.py
      health/
        router.py
      inventory/
        router.py
        models.py
        db.py
      notifications/
        router.py
        models.py
        db.py
      procurement/
        router.py
        models.py
        db.py
      projects/
        router.py
        models.py
        db.py
      reports/
        router.py
        models.py
        db.py
      resources/
        router.py
        models.py
        db.py
      workforce/
        router.py
        models.py
        db.py
    main.py
  tests/
    test_health.py
  .env
  .env.example
  .gitignore
  API_ROUTERS.md
  BACKEND_NOTES.md
  DATABASE_MODULES.md
  pytest.ini
  README.md
  requirements.txt
  requirements-dev.txt
```

## 3. Important Files

### `requirements.txt`

Main dependencies needed to run the API:

- `fastapi`
- `uvicorn`
- `motor`
- `pymongo`
- `pydantic-settings`
- `PyJWT`
- `pwdlib[argon2]`

Install them with:

```powershell
python -m pip install -r requirements.txt
```

### `requirements-dev.txt`

Development dependencies:

- `pytest`
- `pytest-asyncio`
- `httpx`
- `ruff`

Install this during development:

```powershell
python -m pip install -r requirements-dev.txt
```

### `.env.example`

Safe example environment file for the team.

Important values:

```text
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=buildtrack
JWT_SECRET_KEY=change-this-secret-before-production
BACKEND_CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

### `.env`

Local private environment file. It is ignored by git because it can contain secrets.

Never commit real secret keys, passwords, or production database URLs.

## 4. FastAPI App Entry Point

File:

```text
app/main.py
```

This file creates the FastAPI app.

It does five main things:

1. Creates the app with `FastAPI(...)`.
2. Runs a lifespan startup check that pings MongoDB.
3. Adds CORS middleware so Angular can call the backend.
4. Adds root and direct health endpoints.
5. Includes all versioned API routes under `/api/v1`.

Important line:

```python
app.include_router(api_router, prefix=settings.api_v1_prefix)
```

Because `api_v1_prefix` is `/api/v1`, module routes become:

```text
/api/v1/auth/login
/api/v1/projects
/api/v1/workforce/workers
/api/v1/inventory
```

The app also has direct endpoints:

```text
GET /
GET /health
```

## 5. API Router

File:

```text
app/api/router.py
```

This file collects all module routers in one place so `main.py` stays clean.

Currently included routers:

| Module | Prefix | Purpose |
| --- | --- | --- |
| Auth | `/auth` | Register, login, social login, current user profile |
| Frontend Data | `/frontend-data` | Generic MongoDB CRUD routes for frontend screens |
| Health | `/health` | API health check |
| Projects | `/projects` | Project CRUD and milestones |
| Workforce | `/workforce` | Workers and attendance |
| Inventory | `/inventory` | Materials, stock, and transactions |
| Resources | `/resources` | Equipment/resources, assignments, maintenance |
| Procurement | `/procurement` | Vendors and purchase orders |
| Notifications | `/notifications` | User notifications |
| Reports | `/reports` | Reports and dashboard metrics |

## 6. Health Module

File:

```text
app/modules/health/router.py
```

Versioned route:

```text
GET /api/v1/health
```

The app also exposes:

```text
GET /health
```

Health routes are useful for quickly checking whether the backend is running.

## 7. Settings and Config

File:

```text
app/core/config.py
```

This file loads settings from `.env`.

Current settings include:

- app name
- environment name
- debug mode
- API version prefix
- MongoDB URL
- MongoDB database name
- JWT secret key
- JWT algorithm
- access token expiry in minutes
- CORS origins

Use settings like this:

```python
from app.core.config import settings

settings.mongodb_url
settings.mongodb_db_name
settings.jwt_secret_key
settings.cors_origins
```

## 8. MongoDB Setup

File:

```text
app/db/mongodb.py
```

This file creates the MongoDB client and database object:

```python
mongo_client = AsyncIOMotorClient(settings.mongodb_url)
database = mongo_client[settings.mongodb_db_name]
```

Routes get the database through FastAPI dependency injection:

```python
from app.db.mongodb import get_database

async def list_projects(db = Depends(get_database)):
    ...
```

`app/main.py` calls `ping_database()` during startup and closes the MongoDB client during shutdown.

## 9. Security Helpers

File:

```text
app/core/security.py
```

This file supports authentication and protected routes.

Current helpers:

- `create_access_token(...)`: creates JWT access tokens.
- `verify_token(...)`: decodes and validates JWT tokens.
- `hash_password(...)`: hashes plain passwords.
- `verify_password(...)`: checks a plain password against a stored hash.
- `get_current_user(...)`: reads the bearer token, validates it, and loads the user from MongoDB.

JWT tokens include:

```json
{
  "sub": "user_id",
  "exp": "expiration_time",
  "email": "user@example.com",
  "role": "admin"
}
```

Protected endpoints expect:

```text
Authorization: Bearer <access_token>
```

## 10. Auth Module

Folder:

```text
app/modules/auth/
```

Main routes:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/social-login
GET  /api/v1/auth/me
```

What it does:

- Registers users.
- Hashes passwords before storing them.
- Logs users in with email and password.
- Creates demo social login users for Google or Microsoft.
- Returns the current authenticated user profile.

## 11. Feature Modules

Each feature module follows the same basic pattern:

```text
router.py  API endpoints
models.py  Pydantic request/response models
db.py      MongoDB queries and CRUD helpers
```

### Projects

Prefix:

```text
/api/v1/projects
```

Supports:

- create, list, get, update, and delete projects
- filter projects by manager
- add project milestones

Admin and manager users can create/update projects. Only admin users can delete projects.

### Workforce

Prefix:

```text
/api/v1/workforce
```

Supports:

- worker CRUD under `/workers`
- filter workers by project
- filter workers by skill
- attendance records under `/attendance`

Admin and manager users can create/update workers and record attendance. Only admin users can delete workers.

### Inventory

Prefix:

```text
/api/v1/inventory
```

Supports:

- inventory item CRUD
- low-stock listing
- inventory transactions
- transaction history per item

Transactions update stock movement history and are intended to keep material quantities traceable.

### Resources

Prefix:

```text
/api/v1/resources
```

Supports:

- resource CRUD
- list available resources
- list resources by project
- assign resources to worker/project
- unassign resources
- maintenance logs

### Procurement

Prefix:

```text
/api/v1/procurement
```

Supports:

- vendor create/list/get under `/vendors`
- procurement order CRUD
- filter orders by status, project, or vendor

### Notifications

Prefix:

```text
/api/v1/notifications
```

Supports:

- create notifications
- get one notification
- get current user's notifications
- get unread notifications
- mark one notification as read
- mark all current user's notifications as read
- delete notifications
- admin cleanup of old notifications

### Reports

Prefix:

```text
/api/v1/reports
```

Supports:

- create reports
- list reports
- get one report
- filter reports by type or project
- delete reports
- dashboard metrics

### Frontend Data

Prefix:

```text
/api/v1/frontend-data
```

This module provides generic CRUD routes for frontend screens that need direct collection access.

Current frontend data collections:

- `projects`
- `inventory`
- `workers`
- `resources`
- `procurements`
- `attendance`
- `reports`

Request body shape for create/update:

```json
{
  "data": {
    "field": "value"
  }
}
```

These routes still require a valid JWT token.

## 12. Role-Based Access

Common role behavior:

| Role | Typical Access |
| --- | --- |
| `admin` | Full access, including deletes and cleanup tasks |
| `manager` | Can create and update operational records |
| `worker` | Mostly read access to protected endpoints |

The role checks currently happen inside route handlers with `current_user.get("role")`.

## 13. Test Setup

File:

```text
tests/test_health.py
```

The current test checks:

```text
GET /health
GET /api/v1/health
```

Run tests from the `backend` folder:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Expected result:

```text
2 passed
```

## 14. Code Quality Check

Run Ruff from the `backend` folder:

```powershell
.\.venv\Scripts\python.exe -m ruff check app tests
```

Expected result:

```text
All checks passed!
```

## 15. How To Run The Backend

From the backend folder:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

If port `8000` is busy, use another port:

```powershell
uvicorn app.main:app --reload --port 8010
```

Open API docs:

```text
http://127.0.0.1:8000/docs
```

Or if using port `8010`:

```text
http://127.0.0.1:8010/docs
```

## 16. Recommended Learning Path

Study in this order:

1. `app/main.py`
2. `app/api/router.py`
3. `app/core/config.py`
4. `app/db/mongodb.py`
5. `app/core/security.py`
6. `app/modules/auth/router.py`
7. `app/modules/auth/db.py`
8. One full feature module, such as `app/modules/projects/`
9. `tests/test_health.py`

After that, compare `router.py`, `models.py`, and `db.py` inside each module to understand the repeated pattern.

## 17. Next Backend Steps

Useful next improvements:

1. Add endpoint tests for auth, projects, inventory, workforce, resources, procurement, notifications, and reports.
2. Add MongoDB indexes for common filters such as email, project ID, manager ID, status, vendor ID, and unread notifications.
3. Move repeated role checks into reusable dependencies, such as `require_admin` and `require_admin_or_manager`.
4. Review route ordering where static paths and dynamic ID paths live together, for example `low-stock` versus `{item_id}`.
5. Add stricter validators for business rules, such as valid status transitions and positive quantities/costs.
6. Decide whether `frontend_data` is temporary bridge code or part of the long-term API.
7. Add seed data or fixtures for easier local testing.
