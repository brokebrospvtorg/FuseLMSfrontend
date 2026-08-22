import { UserRole } from '../../core/models/enums';

/**
 * Single source of truth for "where does this role land after login /
 * after a forced password change". Pulled out of LoginComponent so
 * ChangePasswordComponent and the guards can reuse it without importing
 * a route-bound component.
 */
const ROLE_HOME: Partial<Record<string, string>> = {
  student: '/student/dashboard',
  teacher: '/teacher/marks',
  coordinator: '/coordinator/grades',
  admin: '/admin/registry',
  parent: '/parent/dashboard',
};

export function getRoleHome(role: UserRole | string | undefined): string {
  return (role && ROLE_HOME[role]) || '/login';
}
