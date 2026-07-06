import { Routes } from "@angular/router";

import { authGuard } from "./core/guards/auth.guard";
import { guestGuard } from "./core/guards/guest.guard";
import { roleGuard } from "./core/guards/role.guard";
import { UserRole } from "./core/models/auth.models";
import { LandingComponent } from "./features/landing/landing.component";
import { RbacComponent } from "./features/rbac/rbac.component";
import { DashboardComponent } from "./features/dashboard/dashboard.component";
import { ForgotPasswordComponent } from "./features/auth/forgot-password/forgot-password.component";
import { LoginComponent } from "./features/auth/login/login.component";
import { ProfileComponent } from "./features/auth/profile/profile.component";
import { RegisterComponent } from "./features/auth/register/register.component";

export const routes: Routes = [
  { path: "", pathMatch: "full", component: LandingComponent },
  { path: "login", component: LoginComponent, canActivate: [guestGuard] },
  { path: "register", component: RegisterComponent, canActivate: [guestGuard] },
  { path: "forgot-password", component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: "rbac", component: RbacComponent, canActivate: [authGuard] },
  { path: "profile", component: ProfileComponent, canActivate: [authGuard] },
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: {
      roles: [
        UserRole.Administrator,
        UserRole.ProjectManager,
        UserRole.SiteEngineer,
        UserRole.Contractor,
        UserRole.Worker,
        UserRole.Client
      ]
    }
  },
  { path: "**", redirectTo: "" }
];
