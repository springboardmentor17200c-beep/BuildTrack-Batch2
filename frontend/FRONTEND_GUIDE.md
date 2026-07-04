# BuildTrack Frontend Guide

This frontend is an Angular standalone application for the BuildTrack construction project management platform. It currently includes mock authentication, protected routes, role-based dashboard cards, profile editing, and Tailwind CSS styling.

## Requirements

- Node.js 20.19 or newer is recommended for Angular 20.
- npm is required.
- The backend can run separately at `http://127.0.0.1:8000`, but the current frontend auth flow uses localStorage mock data until backend auth APIs are connected.

## First-Time Setup

From the project root:

```powershell
cd frontend
npm install
```

If dependencies ever look corrupted or the build reports missing packages, reinstall them:

```powershell
npm install
```

## Run The App

Start the Angular development server:

```powershell
cd frontend
npm start
```

Open the app in a browser:

```text
http://127.0.0.1:4200
```

The `start` script runs:

```powershell
ng serve --host 127.0.0.1 --port 4200
```

## Mock Login

The frontend seeds one local administrator account when the auth service starts:

```text
Email: admin@buildtrack.local
Password: any value with at least 6 characters
```

Registration also works locally. New users and the active session are saved in browser localStorage using these keys:

```text
buildtrack.users
buildtrack.session
```

To reset local demo data, clear the browser localStorage for `127.0.0.1:4200`.

## Useful Commands

Install dependencies:

```powershell
npm install
```

Run development server:

```powershell
npm start
```

Create a production build:

```powershell
npm run build
```

Run Angular tests:

```powershell
npm test
```

Check dependency security:

```powershell
npm audit
```

## Current Verification

The frontend has been verified with:

```powershell
npm run build
```

The build output is generated in:

```text
frontend/dist/buildtrack-frontend
```

## Code Summary

Main app bootstrap:

- `src/main.ts` starts the Angular app and registers routing plus the HTTP auth interceptor.
- `src/app/app.component.ts` hosts the router outlet.
- `src/app/app.routes.ts` defines the public and protected routes.

Auth core:

- `src/app/core/models/auth.models.ts` defines users, roles, sessions, and auth request types.
- `src/app/core/services/auth.service.ts` manages mock login, registration, password reset checks, profile updates, logout, localStorage persistence, and mock JWT creation.
- `src/app/core/guards/auth.guard.ts` blocks protected pages when the user is not logged in.
- `src/app/core/guards/guest.guard.ts` redirects logged-in users away from guest pages.
- `src/app/core/guards/role.guard.ts` checks allowed roles on protected routes.
- `src/app/core/interceptors/auth.interceptor.ts` attaches the bearer token to HTTP requests when a session exists.

Feature screens:

- `src/app/features/auth/login/` contains the login page.
- `src/app/features/auth/register/` contains the registration page.
- `src/app/features/auth/forgot-password/` contains the password reset request page.
- `src/app/features/auth/profile/` contains the profile page.
- `src/app/features/dashboard/` contains the role-based dashboard.

Styling and configuration:

- `src/styles.css` contains Tailwind layers and shared BuildTrack utility classes.
- `tailwind.config.js` defines the BuildTrack color palette and content scanning.
- `postcss.config.js` enables Tailwind and Autoprefixer.
- `angular.json` configures Angular build and serve targets.
- `tsconfig.json` contains strict TypeScript settings with `rootDir` set to `./src`.
- `tsconfig.app.json` configures the app TypeScript entrypoint.

## Current Limitations

- Authentication is still mocked in the browser and is not connected to the FastAPI backend.
- Passwords are not stored or verified securely in the frontend mock flow; this is only for demo navigation.
- Dashboard numbers are static sample values.
- Feature modules for projects, inventory, workforce, procurement, notifications, reports, and analytics still need API-backed pages.
- Frontend automated tests still need to be added.

## Next Frontend Steps

1. Connect login, register, profile, and current-user flows to backend APIs.
2. Replace mock JWT/localStorage user logic with real backend tokens.
3. Add API services for projects, resources, inventory, workforce, procurement, notifications, and reports.
4. Add frontend tests for auth service, route guards, and main forms.
5. Create full module pages after backend endpoints are available.
