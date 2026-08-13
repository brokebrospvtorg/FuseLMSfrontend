import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/enums';

/**
 * Usage in routes: canActivate: [roleGuard([UserRole.Student])]
 * Assumes authGuard already ran (put authGuard first in the array) —
 * this only checks role, not whether someone's logged in at all.
 */
export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = authService.currentUser();
    if (user && allowedRoles.includes(user.role)) {
      return true;
    }

    router.navigate(['/login']);
    return false;
  };
}
