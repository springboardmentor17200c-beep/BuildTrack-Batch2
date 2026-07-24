# BuildTrack Milestone 1 Checkpoint

Milestone: Week 1 & 2  
Focus: Requirements, UI Design, Database Design, Backend Setup, Frontend Setup

## Current Summary

Backend setup has started and the FastAPI project is initialized. The Angular frontend skeleton is now created with Tailwind CSS, auth screens, route guards, and a role-based dashboard. The team decision changed from PostgreSQL to MongoDB, and from Bootstrap to Tailwind CSS.

Overall milestone status:

```text
Mostly Complete
```

## Technology Decisions

| Area | Original Plan | Current Decision | Status |
|---|---|---|---|
| Backend framework | FastAPI | FastAPI | Done |
| Database | PostgreSQL | MongoDB | Changed |
| Frontend framework | Angular | Angular | Done |
| Frontend styling | Angular Material + Tailwind CSS | Tailwind CSS | Done |
| Authentication | JWT | Backend JWT + frontend bearer-token flow | Done |

## Task Checklist

| No. | Task | Status | Notes |
|---|---|---|---|
| i | Define project scope and user roles | Done | Scope and roles are listed in project brief. |
| ii | Gather functional and non-functional requirements | In Progress | Functional modules are listed. Non-functional requirements still need formal writing. |
| iii | Design UI wireframes for all major modules | Pending | Wireframes still need to be created in Figma. |
| iv | Create user flow diagrams and navigation structure | Pending | User flow diagrams not created yet. |
| v | Prepare dashboard layouts for different user roles | Pending | Dashboard screen list exists, layouts not designed yet. |
| vi | Design responsive screen mockups using Figma | Pending | Figma work not started in project files. |
| vii | Design database schema | In Progress | Collections/tables identified. MongoDB schema still needs detailed fields. |
| viii | Initialize FastAPI project | Done | Backend FastAPI scaffold created. |
| ix | Configure PostgreSQL | Changed | Replaced with MongoDB configuration. |
| x | Implement JWT authentication | Done | Backend register/login/social-login/me, password reset request/confirm, JWT verification, and RBAC are implemented. |
| xi | Create Angular frontend skeleton | Done | Angular standalone app is created and builds successfully. |
| xii | Setup Angular Material and Bootstrap UI framework | Changed / Done | Bootstrap replaced by Tailwind CSS. Tailwind is configured and building. |

## Backend Progress

### Completed

- FastAPI backend folder structure created.
- MongoDB dependency added using Motor and PyMongo.
- Environment config added with `.env.example`.
- Local `.env` created.
- CORS configured for Angular local frontend.
- Health endpoint added:
  - `GET /health`
  - `GET /api/v1/health`
- Backend module folders created:
  - auth
  - projects
  - resources
  - inventory
  - workforce
  - procurement
  - notifications
  - reports
- Password hashing helpers added.
- JWT token creation helper added.
- Backend tests added for health endpoints.
- Ruff and pytest configured.
- Backend learning notes created in `backend/BACKEND_NOTES.md`.

## Frontend Progress

### Completed

- Angular standalone application scaffold created in `frontend/`.
- Tailwind CSS configured using `tailwind.config.js`, `postcss.config.js`, and `src/styles.css`.
- App bootstrap configured in `src/main.ts`.
- Route configuration added in `src/app/app.routes.ts`.
- Authentication screens added:
  - login
  - registration
  - forgot password
  - profile
- Dashboard screen added with role-based cards.
- Frontend auth service added with localStorage-backed mock session handling.
- Mock administrator account seeded:
  - email: `admin@buildtrack.local`
  - password: any value with at least 6 characters
- Auth, guest, and role guards added.
- HTTP auth interceptor added to attach the mock bearer token.
- Frontend build verified with `npm run build`.
- Frontend guide added in `frontend/FRONTEND_GUIDE.md`.

### Pending

- Add frontend unit/component tests.
- Add Angular Material components only if the final UI decision still requires them.
- Add MongoDB indexes for production-scale queries.

## Database Design Progress

Original database list:

| Collection | Status | Notes |
|---|---|---|
| users | Done | Includes email, password hash, role, status, and reset-token fields. |
| projects | Done | Includes project details, dates, budget, manager, status, and nested milestones. |
| project_milestones | Changed | Implemented as nested `milestones` inside `projects` instead of a separate collection. |
| resources | Done | Includes equipment/resource type, availability, allocation, and maintenance logs. |
| inventory | Done | Includes material name, quantity, unit, stock status, and transactions. |
| workers | Done | Includes worker profile, skill type, contact, assigned project. |
| attendance | Done | Includes worker, date, status, check-in/check-out. |
| procurements | Done | Includes vendor, items, status, cost, request date. |
| notifications | Done | Includes receiver, message, type, read status. |
| reports | Done | Includes report type, generated by, project, file/export data. |

Because the project now uses MongoDB, these will be designed as MongoDB collections instead of PostgreSQL tables.

## UI Wireframe Checklist

### Authentication Screens

| Screen | Status |
|---|---|
| Login Page | Implemented in Angular |
| Registration Page | Implemented in Angular |
| Password Reset Page | Implemented in Angular |

### Dashboard Screens

| Screen | Status |
|---|---|
| Administrator Dashboard | Implemented as role-based cards |
| Project Manager Dashboard | Implemented as role-based cards |
| Site Engineer Dashboard | Implemented as role-based cards |
| Contractor Dashboard | Implemented as role-based cards |
| Client Dashboard | Implemented as role-based cards |

### Project Management Screens

| Screen | Status |
|---|---|
| Project Listing Page | Implemented in Angular |
| Project Details Page | Implemented in Angular |
| Milestone Tracking Page | Implemented in Angular |
| Project Status Dashboard | Implemented in Angular |

### Resource Management Screens

| Screen | Status |
|---|---|
| Resource Allocation Page | Implemented in Angular |
| Equipment Tracking Page | Implemented in Angular |
| Resource Utilization Dashboard | Implemented in Angular |

### Inventory Screens

| Screen | Status |
|---|---|
| Material Inventory Dashboard | Implemented in Angular |
| Stock Monitoring Screen | Implemented in Angular |
| Procurement Request Screen | Implemented in Angular |

### Workforce Screens

| Screen | Status |
|---|---|
| Worker Management Dashboard | Implemented in Angular |
| Attendance Tracking Screen | Implemented in Angular |
| Shift Scheduling Screen | Implemented in Angular |

### Analytics Screens

| Screen | Status |
|---|---|
| Budget Analytics Dashboard | Implemented in Angular |
| Project Progress Dashboard | Implemented in Angular |
| Resource Analytics Dashboard | Implemented in Angular |
| Procurement Analytics Dashboard | Implemented in Angular |

## Outcome Checklist

| No. | Outcome | Status | Notes |
|---|---|---|---|
| i | UI wireframes completed and approved | Pending | Not completed yet. |
| ii | User flows finalized | Pending | Not completed yet. |
| iii | Backend and frontend architecture setup completed | Done | Backend APIs and Angular app structure are implemented. |
| iv | Authentication flow functional | Done | Backend JWT auth and frontend auth service/interceptor are implemented. |
| v | Database schema finalized | Done | MongoDB schema is documented in `backend/DATABASE_MODULES.md`. |
| vi | Role-based access configured | Done | Backend RBAC dependencies and frontend guards are configured. |
| vii | Angular application structure prepared | Done | Angular skeleton, routing, Tailwind, auth screens, guards, and dashboard are prepared. |

## Current Completion Estimate

Approximate Milestone 1 completion:

```text
85%
```

Reason:

- Backend foundation, JWT authentication, RBAC, and module APIs are created.
- Frontend foundation, protected routing, auth flow, and milestone-required screens build successfully.
- Database schemas are documented for MongoDB.
- Main pending work is formal Figma approval, user-flow diagrams, and production polish such as indexes and tests beyond health checks.

## Recommended Next Steps

1. Create detailed MongoDB schemas for all collections.
2. Implement authentication:
   - register
   - login
   - JWT verification
   - current user endpoint
   - role-based access
3. Connect the Angular auth screens to the backend auth APIs.
4. Create Figma wireframes for authentication and dashboards.
5. Create user flow diagram for each role.
6. Add API-backed pages for projects, inventory, workforce, procurement, notifications, and reports.

