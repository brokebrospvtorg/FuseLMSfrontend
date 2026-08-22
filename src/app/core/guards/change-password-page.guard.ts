import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { getRoleHome } from '../../shared/utils/role-home';

/**
 * Gate for the '/change-password' route itself (paired with authGuard:
 * canActivate: [authGuard, changePasswordPageGuard]).
 *
 * mustChangePasswordGuard pushes users WITH must_change_password=true
 * INTO this route from every portal tree. This guard is the mirror
 * image: it keeps users who do NOT have that flag set from sitting on
 * this forced-change screen (e.g. typing the URL directly, or a stale
 * tab left open after already rotating the password) — they're bounced
 * back to their own portal home instead via getRoleHome.
 *
 * authGuard has already confirmed there's a real session by the time
 * this runs, so authService.currentUser() is trustworthy here.
 */
export const changePasswordPageGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (user?.must_change_password) {
    return true;
  }

  router.navigate([getRoleHome(user?.role)]);
  return false;
};
