import { AssessmentStatus } from './enums';

/** Mirrors app/schemas/marks.py (staff-facing shapes, not the student "me" read-only ones) */

export interface AssessmentFull {
  id: string;
  subject_id: string;
  batch_id: string;
  name: string;
  max_marks: number;
  status: AssessmentStatus;
  created_by: string;
  created_at: string;
}

export interface CreateAssessmentRequest {
  subject_id: string;
  batch_id: string;
  name: string;
  max_marks: number;
}

/** Mirrors AssessmentUpdate — deliberately narrower than create (see
 *  that schema's docstring for why subject_id/batch_id/status aren't here). */
export interface UpdateAssessmentRequest {
  name?: string;
  max_marks?: number;
}

export interface RosterEntry {
  student_id: string;
  full_name: string;
  roll_number: string | null;
}

export interface MarkUpsertPayload {
  student_id: string;
  marks_obtained: number;
}

export interface MarkFull {
  id: string;
  assessment_id: string;
  student_id: string;
  marks_obtained: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface GradeFull {
  id: string;
  student_id: string;
  subject_id: string;
  batch_id: string;
  computed_percentage: number | null;
  letter_grade: string | null;
  is_overridden: boolean;
  overridden_by: string | null;
  override_reason: string | null;
  last_computed_at: string | null;
}

export interface GradeOverridePayload {
  letter_grade: string;
  override_reason: string;
}

/** Mirrors AuditLogOut in app/schemas/marks.py — used by the scoped
 *  /academics/grades/audit-history endpoint, not the general Admin-only
 *  /audit-logs one. */
export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

/** Mirrors MarkEditRequestCreate in app/schemas/marks.py. */
export interface CreateMarkEditRequestPayload {
  requested_change: { marks_obtained: number };
  reason?: string | null;
}

/** Mirrors MarkEditRequestWithContextOut — the enriched shape returned by
 *  both /marks/edit-requests/mine and /marks/edit-requests/pending, with
 *  enough context (names, current value) to render without extra lookups. */
export interface MarkEditRequestFull {
  id: string;
  mark_id: string;
  requested_by: string;
  requested_change: { marks_obtained: number };
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  // schema_update_3.sql — Coordinator/Admin's note when approving/rejecting.
  review_note: string | null;
  created_at: string;
  assessment_name: string;
  subject_name: string;
  student_name: string;
  current_marks_obtained: number;
}

/** Mirrors MarkEditRequestReview in app/schemas/marks.py. */
export interface ReviewMarkEditRequestPayload {
  status: 'approved' | 'rejected';
  review_note?: string | null;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  subject_id: string;
  batch_id: string;
  assigned_by: string;
  assigned_at: string;
}
