import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Blocks access to any route it's attached to unless the session cookie
 * resolves to a real user.
 *
 * On a hard refresh, AuthService's signal is pre-populated from
 * sessionStorage (Sub-Sprint 1.2) purely so the page can paint without a
 * flash of empty state — but that cached value has NOT been confirmed by
 * the server yet this app boot. So this guard checks
 * `hasVerifiedSession`, not just `isAuthenticated()`: until /me has
 * actually round-tripped once, it always re-checks with the server before
 * letting the route through. Once verified, subsequent same-session
 * navigations trust the signal without re-hitting /me every time.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasVerifiedSession && authService.isAuthenticated()) {
    return true;
  }

  return authService.fetchCurrentUser().pipe(
    map(() => true),
    catchError(() => {
      authService.clearLocalState();
      router.navigate(['/login']);
      return of(false);
    }),
  );
};
