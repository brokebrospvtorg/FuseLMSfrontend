import { Board } from './enums';

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
 * (name/code/boards/levels columns) and the row-click detail drawer
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
  boards: Board[];
  levels: TeacherWorkloadLevel[];
  assignments: TeacherWorkloadAssignment[];
  active_subjects_count: number;
  active_batches_count: number;
}
