import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/models';

/**
 * Usage on a route:
 *   { path: 'procurement', data: { roles: ['Administrator', 'Project Manager'] }, canActivate: [authGuard, roleGuard], ... }
 *
 * If the route has no `roles` in its data, anyone authenticated may access it.
 * If the current user's role isn't in the allowed list, they're redirected to /forbidden.
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data?.['roles'] as UserRole[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  const currentRole = auth.currentUser()?.role;
  if (currentRole && allowedRoles.includes(currentRole)) {
    return true;
  }

  router.navigate(['/forbidden']);
  return false;
};
