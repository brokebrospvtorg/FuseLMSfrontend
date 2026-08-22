import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * FORCE PASSWORD CHANGE ON FIRST LOGIN — the actual enforcement gate.
 *
 * Put this on every portal route tree, after authGuard:
 *   canActivate: [authGuard, mustChangePasswordGuard, roleGuard([...])]
 *
 * authGuard has already confirmed there's a real session by the time this
 * runs, so `authService.currentUser()` is trustworthy here. If the account
 * is flagged `must_change_password` (temporary password from account
 * creation, or an Admin/Coordinator reset), every dashboard route bounces
 * to `/change-password` instead of rendering — there is no way to reach
 * portal content with an unrotated temporary password.
 *
 * This complements, but does not replace, the informational nudge badge
 * in PortalLayoutComponent: that badge covers the case where the flag
 * flips to true *during* an already-open session (e.g. an Admin resets
 * this user's password while they're mid-session elsewhere) — this guard
 * covers every fresh navigation, which is the case the task calls out.
 */
export const mustChangePasswordGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user?.must_change_password) {
    router.navigate(['/change-password']);
    return false;
  }

  return true;
};
