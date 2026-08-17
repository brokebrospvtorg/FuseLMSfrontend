import { CanActivateFn } from '@angular/router';

import { UserRole } from '../models/enums';
import { roleGuard } from './role.guard';

/**
 * Gate for every /teacher/** route.
 *
 * This is a thin, explicitly-named wrapper around roleGuard rather than a
 * separate implementation — the actual role check is identical, but giving
 * it its own name/file makes the route tree read clearly (canActivate:
 * [authGuard, teacherGuard]) and gives future-you one place to add
 * teacher-specific logic later without touching the generic roleGuard.
 *
 * Fee System and Information Registry are NOT blocked by any special-case
 * logic in here — they're simply not registered anywhere under the
 * /teacher/** route tree (see app.routes.ts), so there is no URL a Teacher
 * can type that reaches them client-side. The real enforcement for both is
 * still server-side: every fees/*  and users/* (registry) endpoint has its
 * own require_roles(...) check in the backend regardless of what routes
 * exist on the frontend, so this guard is a UX convenience, not the
 * security boundary.
 */
export const teacherGuard: CanActivateFn = (route, state) => {
  return roleGuard([UserRole.Teacher])(route, state);
};
