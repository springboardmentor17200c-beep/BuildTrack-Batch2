# BuildTrack Connected App

This repository contains the BuildTrack Batch 2 full-stack workspace:

- FastAPI backend (`backend`)
- Angular frontend (`frontend`)

## Current Progress Summary

- Milestone 2 core modules are integrated (Projects, Resources, Inventory, Workforce, Procurement).
- Milestone 3 backend scope is complete for Procurement, Notifications, Reports, Dashboard analytics, and Document management.
- Backend API routes are JWT-protected with role-based access controls.
- Backend test suite currently passes.

## Consolidated Progress Records

- Backend record up to Milestone 3: `BACKEND_PROGRESS.md`
- Frontend record up to Milestone 3: `FRONTEND_PROGRESS.md`

## Backend Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Backend URL: `http://127.0.0.1:8000`

## Frontend Run

```powershell
cd frontend
npm install
npm run start:api
```

Frontend URL: `http://localhost:4200`

## Key Backend Endpoint Groups

- Auth: `/api/v1/auth/*`
- Projects: `/api/v1/projects/*`
- Resources: `/api/v1/resources/*`
- Inventory: `/api/v1/inventory/*`
- Workforce: `/api/v1/workforce/*`
- Procurement: `/api/v1/procurement/*`, plus top-level compatibility routes `/api/v1/procurements` and `/api/v1/vendors`
- Notifications: `/api/v1/notifications/*`
- Reports and Analytics: `/api/v1/reports/*`
- Documents: `/api/v1/documents/*`

## Verification

Run backend tests:

```powershell
cd backend
python -m pytest tests -q
```
