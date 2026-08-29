/**
 * Mirrors app/schemas/teacher.py::TeacherWorkloadLevelOut — one Level this
 * teacher is assigned to teach, joined with its display name (from
 * teacher_levels + levels).
 */
export interface TeacherWorkloadLevel {
  level_id: string;
  level_name: string;
}

/**
 * Mirrors app/schemas/teacher.py::TeacherWorkloadAssignmentOut — one
 * active (non-deleted) teacher_subject_assignments row, joined with
 * subject/batch display names.
 *
 * Note: this shape does NOT carry the assignment's own `id` — it's the
 * Teachers list/detail-drawer's read-only view. Manage Teacher's "Current
 * Assignments" table (which needs an id to call the DELETE endpoint)
 * resolves ids separately via AcademicsStaffService.getTeacherAssignmentsFor()
 * — see ManageTeacherDialogComponent.loadAssignments().
 */
export interface TeacherWorkloadAssignment {
  subject_id: string;
  subject_name: string;
  batch_id: string;
  batch_name: string;
}

/**
 * Mirrors app/schemas/teacher.py::TeacherWorkloadSummaryOut — one row of
 * GET /api/teachers/workload-summary. Powers both the Teachers list table
 * (name/code/levels columns) and the row-click detail drawer
 * (levels + assignments) — the list call already returns everything the
 * drawer needs, so opening a row doesn't trigger a second request (unlike
 * the Batch Summary drawer's separate GET .../batches/{id}/summary).
 */
export interface TeacherWorkloadSummary {
  id: string;
  full_name: string;
  email: string;
  teacher_code: string | null;
  phone_number: string | null;
  levels: TeacherWorkloadLevel[];
  assignments: TeacherWorkloadAssignment[];
  active_subjects_count: number;
  active_batches_count: number;
}

/**
 * Mirrors app/schemas/teacher.py::TeacherAssignmentCreateRequest — body for
 * POST /api/teachers/{teacher_id}/assignments (Workload Management "Add
 * Assignment" form in ManageTeacherDialogComponent). teacher_id itself
 * comes from the URL path, not this body — see TeacherService.assignToTeacher.
 */
export interface TeacherAssignmentCreatePayload {
  subject_id: string;
  batch_id: string;
}
