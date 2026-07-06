import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { UserRole } from "../models/auth.models";
import { AuthService } from "../services/auth.service";

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data["roles"] ?? []) as UserRole[];
  const user = auth.currentUser();

  if (!user) {
    return router.createUrlTree(["/login"]);
  }

  return allowedRoles.length === 0 || allowedRoles.includes(user.role)
    ? true
    : router.createUrlTree(["/profile"]);
};
