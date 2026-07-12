import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";
import { roleGuard } from "./core/guards/role.guard";
import { UserRole } from "./core/models/models";

const ALL_ROLES: UserRole[] = [
  "Administrator",
  "Project Manager",
  "Site Engineer",
  "Contractor",
  "Worker",
  "Client",
];

export const routes: Routes = [
  // Landing Page
  {
    path: "",
    loadComponent: () =>
      import("./features/landing/landing.component").then(
        (m) => m.LandingComponent,
      ),
  },

  // Authentication
  {
    path: "auth/login",
    loadComponent: () =>
      import("./features/auth/login/login.component").then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: "auth/register",
    loadComponent: () =>
      import("./features/auth/register/register.component").then(
        (m) => m.RegisterComponent,
      ),
  },
  {
    path: "auth/forgot-password",
    loadComponent: () =>
      import("./features/auth/forgot-password/forgot-password.component").then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: "forbidden",
    loadComponent: () =>
      import("./features/forbidden/forbidden.component").then(
        (m) => m.ForbiddenComponent,
      ),
  },

  // Protected Routes
  {
    path: "",
    loadComponent: () =>
      import("./layout/main-layout/main-layout.component").then(
        (m) => m.MainLayoutComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: "dashboard",
        loadComponent: () =>
          import("./features/dashboard/dashboard.component").then(
            (m) => m.DashboardComponent,
          ),
        canActivate: [roleGuard],
        data: { roles: ALL_ROLES },
      },
      {
        path: "projects",
        loadComponent: () =>
          import("./features/projects/project-list/project-list.component").then(
            (m) => m.ProjectListComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
            "Contractor",
            "Client",
          ] as UserRole[],
        },
      },
      {
        path: "projects/:id",
        loadComponent: () =>
          import("./features/projects/project-details/project-details.component").then(
            (m) => m.ProjectDetailsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
            "Contractor",
            "Client",
          ] as UserRole[],
        },
      },
      {
        path: "resources",
        loadComponent: () =>
          import("./features/resources/resources.component").then(
            (m) => m.ResourcesComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
          ] as UserRole[],
        },
      },
      {
        path: "inventory",
        loadComponent: () =>
          import("./features/inventory/inventory.component").then(
            (m) => m.InventoryComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
          ] as UserRole[],
        },
      },
      {
        path: "workers",
        loadComponent: () =>
          import("./features/workers/workers.component").then(
            (m) => m.WorkersComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
          ] as UserRole[],
        },
      },
      {
        path: "attendance",
        loadComponent: () =>
          import("./features/attendance/attendance.component").then(
            (m) => m.AttendanceComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
            "Worker",
          ] as UserRole[],
        },
      },
      {
        path: "procurement",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ["Administrator", "Project Manager"] as UserRole[],
        },
      },
      {
        path: "reports",
        loadComponent: () =>
          import("./features/reports/reports.component").then(
            (m) => m.ReportsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Client",
          ] as UserRole[],
        },
      },
      {
        path: "settings",
        loadComponent: () =>
          import("./features/settings/settings.component").then(
            (m) => m.SettingsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ["Administrator"] as UserRole[],
        },
      },

      // Default protected route
      {
        path: "",
        pathMatch: "full",
        redirectTo: "dashboard",
      },
    ],
  },

  // Fallback
  {
    path: "**",
    redirectTo: "",
  },
];