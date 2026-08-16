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
  "Vendor",
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
        path: "projects/milestones",
        loadComponent: () =>
          import("./features/projects/milestones/milestones.component").then(
            (m) => m.MilestonesComponent,
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
        path: "projects/status-dashboard",
        loadComponent: () =>
          import("./features/projects/status-dashboard/status-dashboard.component").then(
            (m) => m.ProjectStatusDashboardComponent,
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
        path: "resources/equipment",
        loadComponent: () =>
          import("./features/resources/equipment-tracking/equipment-tracking.component").then(
            (m) => m.EquipmentTrackingComponent,
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
        path: "resources/utilization",
        loadComponent: () =>
          import("./features/resources/utilization-dashboard/utilization-dashboard.component").then(
            (m) => m.ResourceUtilizationDashboardComponent,
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
        path: "inventory/stock-monitoring",
        loadComponent: () =>
          import("./features/inventory/stock-monitoring/stock-monitoring.component").then(
            (m) => m.StockMonitoringComponent,
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
        path: "workers/shift-scheduling",
        loadComponent: () =>
          import("./features/workers/shift-scheduling/shift-scheduling.component").then(
            (m) => m.ShiftSchedulingComponent,
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
        path: "workers/allocation",
        loadComponent: () =>
          import("./features/allocation/allocation.component").then(
            (m) => m.AllocationComponent,
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
        path: "workers/payroll",
        loadComponent: () =>
          import("./features/payroll/payroll.component").then(
            (m) => m.PayrollComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
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
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
            "Store Manager",
            "Finance",
          ] as UserRole[],
        },
      },
      {
        path: "procurement/dashboard",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
            "Site Engineer",
            "Store Manager",
            "Finance",
          ] as UserRole[],
        },
      },
      {
        path: "procurement/request",
        loadComponent: () =>
          import("./features/procurement/request/procurement-request.component").then(
            (m) => m.ProcurementRequestComponent,
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
        path: "procurement/vendor-dashboard",
        loadComponent: () =>
          import("./features/procurement/vendor-dashboard/vendor-dashboard.component").then(
            (m) => m.VendorDashboardComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ["Vendor"] as UserRole[],
        },
      },
      {
        path: "procurement/material-requests",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
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
        path: "procurement/purchase-orders",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
          ] as UserRole[],
        },
      },
      {
        path: "procurement/vendors",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Project Manager",
          ] as UserRole[],
        },
      },
      {
        path: "procurement/deliveries",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Store Manager",
            "Project Manager",
          ] as UserRole[],
        },
      },
      {
        path: "procurement/inventory",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Store Manager",
            "Project Manager",
            "Site Engineer",
          ] as UserRole[],
        },
      },
      {
        path: "procurement/invoices",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Finance",
            "Project Manager",
          ] as UserRole[],
        },
      },
      {
        path: "procurement/payments",
        loadComponent: () =>
          import("./features/procurement/procurement.component").then(
            (m) => m.ProcurementComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: [
            "Administrator",
            "Finance",
          ] as UserRole[],
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
        path: "analytics/budget",
        loadComponent: () =>
          import("./features/analytics/budget/budget-analytics.component").then(
            (m) => m.BudgetAnalyticsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ["Administrator", "Project Manager", "Client"] as UserRole[],
        },
      },
      {
        path: "analytics/progress",
        loadComponent: () =>
          import("./features/analytics/progress/progress-analytics.component").then(
            (m) => m.ProgressAnalyticsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ["Administrator", "Project Manager", "Client"] as UserRole[],
        },
      },
      {
        path: "analytics/resource",
        loadComponent: () =>
          import("./features/analytics/resource/resource-analytics.component").then(
            (m) => m.ResourceAnalyticsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ["Administrator", "Project Manager"] as UserRole[],
        },
      },
      {
        path: "analytics/procurement",
        loadComponent: () =>
          import("./features/analytics/procurement/procurement-analytics.component").then(
            (m) => m.ProcurementAnalyticsComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ["Administrator", "Project Manager"] as UserRole[],
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
      {
        path: "notifications",
        loadComponent: () =>
          import("./features/notifications/notification.component").then(
            (m) => m.NotificationComponent,
          ),
        canActivate: [roleGuard],
        data: {
          roles: ALL_ROLES,
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