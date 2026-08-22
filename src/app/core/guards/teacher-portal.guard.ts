import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';

import { AuthService } from '../services/auth.service';
import { RoleSwitchService } from '../services/role-switch.service';
import { UserRole } from '../models/enums';

/**
 * Replaces the plain `teacherGuard` on the "/teacher/**" route tree.
 * Same authGuard-must-run-first assumption as roleGuard (canActivate:
 * [authGuard, teacherPortalGuard]).
 *
 * Admits two cases:
 *   1. A real Teacher account (user.role === 'teacher') — identical to
 *      the old teacherGuard, zero behavior change for every Teacher who
 *      isn't also a Coordinator.
 *   2. A Coordinator account that RoleSwitchService confirms has at
 *      least one active TeacherSubjectAssignment — lets the Dual-Role
 *      Switcher's "View as Teacher" option actually land here instead
 *      of bouncing straight back out.
 *
 * Everyone else (Admin, Student, Parent, or a Coordinator with no
 * teaching assignment) is redirected to '/login' — same fallback
 * roleGuard uses elsewhere, so a stray/typed URL doesn't behave
 * differently here than on any other protected route.
 *
 * Reminder (see RoleSwitchService's own docstring): this guard is a
 * frontend UX gate only. It decides whether the Teacher Portal's pages
 * render for a dual-role Coordinator — it has no effect on whether the
 * backend's require_roles("teacher") endpoints those pages call will
 * actually accept that Coordinator's requests. That's a separate,
 * still-open backend change (see delivery README).
 */
export const teacherPortalGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const roleSwitchService = inject(RoleSwitchService);
  const router = inject(Router);

  return roleSwitchService.checkTeacherPortalEligibility().pipe(
    map((eligible) => {
      if (eligible) return true;
      // Distinguish "a Coordinator with no teaching assignment" (belongs
      // back in their own portal) from everyone else who has no
      // business in "/teacher/**" at all (Admin, Student, Parent, or not
      // logged in — same '/login' fallback roleGuard uses elsewhere).
      const user = authService.currentUser();
      router.navigate([user?.role === UserRole.Coordinator ? '/coordinator/dashboard' : '/login']);
      return false;
    }),
  );
};