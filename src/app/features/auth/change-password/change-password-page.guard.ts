import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { getRoleHome } from '../utils/role-home';

/**
 * Put on the '/change-password' route itself, after authGuard. Keeps this
 * route reserved for the forced first-login flow: someone whose account
 * is NOT flagged must_change_password has no reason to land here (that
 * voluntary case is already served by the header's "Change Password"
 * dialog inside the portal), so send them back to their normal home
 * instead of showing them a dead-end forced-change screen.
 */
export const changePasswordPageGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (!user?.must_change_password) {
    router.navigate([getRoleHome(user?.role)]);
    return false;
  }

  return true;
};
