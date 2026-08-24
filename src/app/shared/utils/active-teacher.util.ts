import { UserStatus } from '../../core/models/enums';

/**
 * Deleted teachers never reach the frontend at all — every list endpoint
 * that can return a Teacher (GET /api/users?role=teacher, GET
 * /api/teachers/workload-summary) already filters `deleted_at IS NULL`
 * server-side (see app/routers/users.py::list_users and
 * app/routers/teachers.py::get_teacher_workload_summary). This helper
 * exists for the layer above that: a *suspended* (not deleted) Teacher
 * account still exists and is intentionally still visible in the
 * Registry, but shouldn't be offered as a selectable option anywhere new
 * work gets assigned to them — Manage Batch's "Assign Teacher" picker,
 * the Interactive Timetable Builder's Teacher Assignee stage, and any
 * future picker of the same shape.
 *
 * Deliberately structural (`{ status: UserStatus }`) rather than typed to
 * `User` specifically, since both `User` and `RegistryUser` carry `status`
 * but aren't otherwise the same shape.
 */
export function isAssignableTeacher(teacher: { status: UserStatus }): boolean {
  return teacher.status === UserStatus.Active;
}
