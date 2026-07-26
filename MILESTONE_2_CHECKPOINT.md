# BuildTrack Milestone 2 Checkpoint

Milestone: Week 3 & 4  
Focus: Project, Resource, Inventory, Workforce management + API integration

## Overall Status

```text
Complete (frontend integration)
```

## Milestone 2 Requirements

| Area | Status | Notes |
|------|--------|-------|
| Project list from backend | Done | `GET /api/v1/projects/` |
| Add / Edit project forms | Done | Reactive forms + `POST/PUT /projects` |
| Project details | Done | `GET /projects/{id}` with milestones |
| Project status updates | Done | Maps Planning/In Progress/On Hold/Completed |
| Project milestones | Done | Nested milestones + `POST /projects/{id}/milestones` |
| Resource list + CRUD | Done | `GET/POST/PUT/DELETE /resources` |
| Resource allocation | Done | Project dropdown + assign endpoint |
| Resource utilization views | Done | Utilization & equipment screens use live data |
| Inventory list + CRUD | Done | `GET/POST/PUT/DELETE /inventory` |
| Stock quantity updates | Done | `POST /inventory/{id}/transactions` |
| Low-stock alerts | Done | `GET /inventory/low-stock` + banner |
| Material request screens | Done | Procurement + request form via `/procurement` |
| Worker list + CRUD | Done | `GET/POST/PUT/DELETE /workforce/workers` |
| Assign workers to projects | Done | Project dropdown on worker form |
| Attendance screen | Done | `POST /workforce/attendance` + aggregated list |
| Shift scheduling | Done | Existing UI reads worker/project data |
| HttpClient API integration | Done | Replaced `/frontend-data` bridge for core modules |
| Loading & error handling | Done | Loading banners + toast notifications |
| Success notifications | Done | `NotificationService` toasts on CRUD |
| Reactive form validation | Done | All CRUD modals |
| Confirmation dialogs | Done | `ConfirmService` (replaces `window.confirm`) |
| Search, filter, pagination | Done | Client-side on all list screens |
| Responsive design | Done | Existing Tailwind responsive rules retained |

## Key Frontend Changes

- **`MockDataService`** — rewritten to call typed FastAPI endpoints with DTO mappers in `core/utils/api-mappers.ts`.
- **`NotificationService`** + toast container for success/error feedback.
- **`ConfirmService`** + confirm dialog for delete actions.
- **Project, Resource, Inventory, Workers, Attendance, Procurement** screens updated for async CRUD, filters, and pagination.
- **Auth** — session refresh via `GET /auth/me` on app load.

## How to Run

```powershell
# Terminal 1 — Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm install
npm run start:api
```

Open `http://localhost:4200`, log in, and use Projects / Resources / Inventory / Workers / Attendance modules.

## Notes

- Register a user with role **admin** or **manager** to create/edit/delete records (backend RBAC).
- Attendance list aggregates records per worker because the backend exposes `GET /workforce/attendance/{worker_id}` only.
- Shift scheduling remains a read-only planning view derived from worker assignments.
