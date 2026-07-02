# BuildTrack Backend Notes

These notes explain what was set up in the backend and why each part exists.

## 1. What We Built

The backend is a Python FastAPI API for the BuildTrack construction project management platform.

Current backend stack:

- FastAPI: creates API endpoints.
- Uvicorn: runs the FastAPI server.
- MongoDB: database for storing users, projects, resources, reports, etc.
- Motor: async MongoDB driver for Python.
- Pydantic Settings: loads environment variables from `.env`.
- PyJWT: creates and verifies JWT login tokens.
- pwdlib: hashes passwords securely.
- Pytest: tests the backend.
- Ruff: checks code style and catches simple mistakes.

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
      health/
      inventory/
      notifications/
      procurement/
      projects/
      reports/
      resources/
      workforce/
    main.py
  tests/
    test_health.py
  .env
  .env.example
  .gitignore
  pytest.ini
  README.md
  requirements.txt
  requirements-dev.txt
```

## 3. Important Files

### `requirements.txt`

This file contains the main backend dependencies needed to run the app.

Example packages:

- `fastapi`: API framework.
- `uvicorn`: development server.
- `motor`: connects FastAPI to MongoDB.
- `pymongo`: MongoDB driver used by Motor.
- `pydantic-settings`: loads settings from environment variables.
- `PyJWT`: JWT token support.
- `pwdlib[argon2]`: password hashing.

Install them with:

```powershell
python -m pip install -r requirements.txt
```

### `requirements-dev.txt`

This includes everything in `requirements.txt`, plus developer tools:

- `pytest`
- `pytest-asyncio`
- `httpx`
- `ruff`

Install this during development:

```powershell
python -m pip install -r requirements-dev.txt
```

### `.env.example`

This is a safe example environment file. It shows your team which settings are required.

Important values:

```text
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=buildtrack
JWT_SECRET_KEY=change-this-secret-before-production
BACKEND_CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
```

### `.env`

This is your local private environment file. It is ignored by git because it can contain secrets.

Never commit real secret keys, passwords, or production database URLs.

## 4. FastAPI App Entry Point

File:

```text
app/main.py
```

This file creates the FastAPI application.

It does four main things:

1. Creates the app using `FastAPI(...)`.
2. Adds CORS middleware so Angular can call the backend.
3. Adds a simple `/health` endpoint.
4. Includes all versioned API routes under `/api/v1`.

Example:

```python
app.include_router(api_router, prefix=settings.api_v1_prefix)
```

Because `api_v1_prefix` is `/api/v1`, the backend routes become:

```text
/api/v1/health
```

## 5. API Router

File:

```text
app/api/router.py
```

This file collects all module routers in one place.

Right now it includes the health router:

```python
api_router.include_router(health_router, prefix="/health", tags=["Health"])
```

Later, you can add routers like:

```python
api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(project_router, prefix="/projects", tags=["Projects"])
```

This keeps `main.py` clean.

## 6. Health Module

File:

```text
app/modules/health/router.py
```

This has a simple route:

```text
GET /api/v1/health
```

It returns:

```json
{"status": "ok"}
```

Health routes are useful because they let you quickly check if the backend is running.

## 7. Settings and Config

File:

```text
app/core/config.py
```

This file loads settings from `.env`.

Examples:

- app name
- debug mode
- MongoDB URL
- MongoDB database name
- JWT secret key
- CORS origins

Instead of hardcoding settings in many files, we use:

```python
from app.core.config import settings
```

Then we can access:

```python
settings.mongodb_url
settings.mongodb_db_name
settings.jwt_secret_key
```

## 8. MongoDB Setup

File:

```text
app/db/mongodb.py
```

This file creates the MongoDB connection.

Main idea:

```python
mongo_client = AsyncIOMotorClient(settings.mongodb_url)
database = mongo_client[settings.mongodb_db_name]
```

That means:

- Connect to MongoDB using `MONGODB_URL`.
- Select the database named `buildtrack`.

When future routes need the database, they can use:

```python
from app.db.mongodb import get_database
```

Example future route:

```python
@router.get("/projects")
async def list_projects(db = Depends(get_database)):
    projects = await db.projects.find().to_list(length=100)
    return projects
```

## 9. Security Helpers

File:

```text
app/core/security.py
```

This file has helper functions for authentication.

It currently supports:

- Creating JWT access tokens.
- Hashing passwords.
- Verifying passwords.

Why password hashing matters:

You should never store plain passwords like:

```text
password123
```

Instead, store a hashed version. During login, compare the login password against the hash.

## 10. Test Setup

File:

```text
tests/test_health.py
```

This tests that the health endpoints work.

It checks:

```text
GET /health
GET /api/v1/health
```

Run tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Expected result:

```text
2 passed
```

## 11. Code Quality Check

Ruff checks Python code for style and common mistakes.

Run:

```powershell
.\.venv\Scripts\python.exe -m ruff check app tests
```

Expected result:

```text
All checks passed!
```

## 12. How To Run The Backend

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

## 13. Why We Created Module Folders

The project has many features:

- auth
- projects
- resources
- inventory
- workforce
- procurement
- notifications
- reports

Instead of putting everything in one big file, each feature gets its own module.

Example future structure:

```text
app/modules/projects/
  router.py
  schemas.py
  service.py
```

Meaning:

- `router.py`: API endpoints.
- `schemas.py`: request and response models.
- `service.py`: business logic.

This makes teamwork easier because each teammate can work on one module.

## 14. Backend Learning Path

Study in this order:

1. `app/main.py`
2. `app/api/router.py`
3. `app/modules/health/router.py`
4. `app/core/config.py`
5. `app/db/mongodb.py`
6. `app/core/security.py`
7. `tests/test_health.py`

After that, try creating your first real module, such as project management.

## 15. Next Backend Step

The next useful backend feature is authentication.

Authentication should include:

- user registration
- user login
- password hashing
- JWT token generation
- role-based access control

Roles for BuildTrack:

- Administrator
- Project Manager
- Site Engineer
- Contractor
- Worker
- Client

After auth, the next module should be project management.

