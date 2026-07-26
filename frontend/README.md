# BuildTrack — Frontend (Milestone 1)

Angular 18 frontend for the BuildTrack Construction Project Management &amp; Site
Monitoring Platform, built against the Milestone 1 brief (Week 1 &amp; 2:
Requirements, UI Design, Database Design & Backend Setup — frontend half).

## Run it

```bash
npm install
npm start
```

Opens at `http://localhost:4200`. Log in with any email/password — auth is
mocked (see below) so the full flow works before the FastAPI backend is live.

## What's implemented (Milestone 1 scope)

**Authentication screens**
- Login (`/auth/login`) — email/password, show/hide password, remember me,
  Google/Microsoft social buttons (UI only), validation messages.
- Register (`/auth/register`) — full name/email/password/confirm, matching-password
  validation.
- Forgot Password (`/auth/forgot-password`) — email + reset-link confirmation state.

**Angular application skeleton**
- Standalone components (Angular 18), lazy-loaded routes per module (`app.routes.ts`).
- `AuthGuard` protecting everything under the main layout.
- `authInterceptor` attaching the JWT bearer token to outgoing requests.
- Angular Material dependency wired in `package.json` (ready for form fields/dialogs
  as modules get built out); Bootstrap included globally for grid/utilities;
  Chart.js used for dashboard/report charts per the tech stack doc.

**Main layout & dashboard**
- Persistent sidebar (all modules from the brief: Dashboard, Projects, Resources,
  Inventory, Workers, Attendance, Procurement, Reports) + topbar (search,
  notifications, profile).
- Dashboard: stat cards, project overview donut chart, project status line chart,
  recent projects, upcoming milestones — matches the reference mockups.

**Role-based access control (RBAC)**
- Login page has a "Sign in as" role selector (demo-only, until the backend returns
  real roles on login) — lets you test every role without a database.
- `roleGuard` on every route under the main layout, each with its own allowed-roles list:
  - Dashboard — all roles
  - Projects — everyone except Worker
  - Resources / Inventory / Workers — Administrator, Project Manager, Site Engineer
  - Attendance — adds Worker (can view own attendance)
  - Procurement — Administrator, Project Manager only
  - Reports — Administrator, Project Manager, Client
  - Settings — Administrator only
- Sidebar links are filtered live based on the signed-in user's role
  (`SidebarComponent.navItems` computed signal) — you only ever see links you can access.
- `HasRoleDirective` (`*appHasRole="[...]"`) — reusable structural directive to hide/show
  any button or section by role inside a shared template.
- `/forbidden` page — shown if someone navigates directly to a route their role
  doesn't allow, instead of a silent redirect.

**Module screens (UI shells with sample data, ready to wire to FastAPI)**
- Projects — list + detail (tabs, milestone progress, team members).
- Resources, Inventory, Workers, Attendance, Procurement — each with the
  search/filter toolbar, data table, status badges, and pagination footer pattern.
- Reports & Analytics — budget vs expense bar chart, project progress donut.

## Where the mock data lives

`src/app/core/services/mock-data.service.ts` holds all sample records (projects,
workers, inventory, etc.) so every screen renders real-looking content without
a backend. `src/app/core/services/auth.service.ts` has a `useMockApi` flag —
flip it to `false` once `POST /login`, `POST /register`, `GET /profile` are live
on FastAPI, matching the API list in the project brief.

## Folder structure

```
src/app/
  core/
    guards/          # authGuard
    interceptors/     # JWT bearer interceptor
    models/           # TypeScript interfaces (User, Project, Worker, ...)
    services/          # AuthService, MockDataService
  layout/
    sidebar/           # left nav
    topbar/            # search + notifications + profile
    main-layout/        # shell wrapping sidebar + topbar + <router-outlet>
  features/
    auth/login | register | forgot-password
    dashboard/
    projects/ (list, details)
    resources/
    inventory/
    workers/
    attendance/
    procurement/
    reports/
```

This mirrors the "Recommended Folder Structure" from the project brief
(components / pages / services / models / guards / interceptors, split by feature).

## Next milestones (not in this drop)

- Milestone 2: wire Projects/Resources/Workforce screens to real FastAPI CRUD
  endpoints, replace `MockDataService` calls with `HttpClient` services.
- Milestone 3: Procurement/Notifications/Reports backend integration, PDF/Excel export.
- Milestone 4: Analytics polish, testing (Angular Testing + Selenium/Postman
  per the tech stack), deployment.
