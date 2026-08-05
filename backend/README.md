# BuildTrack Backend

FastAPI + MongoDB backend for the BuildTrack construction project management platform.

## Status

- Milestone 2 backend modules completed.
- Milestone 3 backend modules completed:
  - Procurement system (including vendors, suppliers, purchase orders, invoice tracking)
  - Notification service
  - Reporting module
  - Dashboard analytics
  - Document management (upload/list/get/download/delete)
- JWT authentication + role-based authorization enabled across protected routes.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload
```

The API will run at `http://127.0.0.1:8000`.

Make sure MongoDB is running locally at `mongodb://localhost:27017`, or update
`MONGODB_URL` in `.env`.

Useful endpoints:

- `GET /health`
- `GET /api/v1/health`
- `GET /docs`

## API Groups

- `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `GET /api/v1/auth/me`
- Projects: `/api/v1/projects/*`
- Resources: `/api/v1/resources/*`
- Inventory: `/api/v1/inventory/*`
- Workforce: `/api/v1/workforce/*`
- Procurement: `/api/v1/procurement/*`
- Compatibility routes: `/api/v1/procurements/*`, `/api/v1/vendors/*`
- Notifications: `/api/v1/notifications/*`
- Reports: `/api/v1/reports/*`
- Documents: `/api/v1/documents/*`

## Tests

```powershell
cd backend
python -m pytest tests -q
```

Current local status: backend tests passing.

## Project Structure

```text
app/
  api/          API route registration
  core/         Settings, security, shared configuration
  db/           MongoDB client and database dependencies
  modules/      Feature modules such as auth, projects, inventory
  main.py       FastAPI application factory entrypoint
```
