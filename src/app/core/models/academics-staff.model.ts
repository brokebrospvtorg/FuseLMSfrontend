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

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  subject_id: string;
  batch_id: string;
  assigned_by: string;
  assigned_at: string;
}
