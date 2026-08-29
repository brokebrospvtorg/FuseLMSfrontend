import { BatchSession, LevelEnrollmentStatus, SubjectRequestStatus, EnrollmentStatus } from './enums';

/** Mirrors app/models/academic.py */

export interface Batch {
  id: string;
  session: BatchSession;
  year: number;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  // schema_update_13: "is this batch open for admin work" (assigning
  // teachers, offering subjects, taking subject requests) — independent
  // of is_current above. Defaults true server-side (see Batch.is_active
  // in models/academic.py), so it's always present on a BatchOut, not
  // optional.
  is_active: boolean;
  // Mirrors BatchOut in schemas/academic.py — computed server-side from
  // Enrollment/TeacherSubjectAssignment, not stored columns. Always
  // present now (list_batches populates them for every batch), default 0
  // for a freshly created batch.
  active_students_count: number;
  assigned_teachers_count: number;
}

/** One entry from the backend's Batch Generator (GET
 *  /api/academic/batches/generate) — a session/year combination that
 *  SHOULD exist per the standard 5-year window, flagged with whether a
 *  real Batch row has been created for it yet. Distinct from the
 *  frontend-only BatchTemplate in shared/utils/batch-generator.util.ts,
 *  which has no `already_exists` (it doesn't know what's in the DB). */
export interface GeneratedBatchTemplate {
  session: BatchSession;
  year: number;
  name: string;
  start_date: string;
  end_date: string;
  already_exists: boolean;
}

/** Only session/year is required — name/start_date/end_date are derived
 *  server-side by the same generator if omitted (see BatchCreate in
 *  app/schemas/academic.py). */
export interface CreateBatchPayload {
  session: BatchSession;
  year: number;
  is_current?: boolean;
}

/** Mirrors BatchUpdate in app/schemas/academic.py — PUT
 *  /academic/batches/{batch_id}. `board` used to be the only editable
 *  field here (Admin correcting the examining board at creation time) —
 *  that field is gone along with the Board entity. What's left is
 *  correcting a batch's exam session (May/June vs Oct/Nov) and/or its
 *  target year after creation; both optional so a caller can patch just
 *  one of them. */
export interface UpdateBatchPayload {
  session?: string;
  year?: number;
}

export interface Level {
  id: string;
  name: string;
  code: string;
  display_order: number;
  is_active: boolean;
}

/**
 * Subject catalog. `level_id`/`level_name` stay as the single "primary"
 * level for existing single-level consumers (offer-subjects, teacher
 * assignment, enrollment) — see app/models/academic.py Subject's
 * docstring for why both exist alongside `levels`.
 */
export interface Subject {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  level_id: string;
  // Joined in by the backend for display convenience — not a real column.
  level_name?: string | null;
  levels: Level[];
}

/** POST /api/academic/subjects request body. */
export interface SubjectCreatePayload {
  name: string;
  code: string;
  level_ids: string[];
}

/** PUT /api/academic/subjects/{id} request body — Admin Subjects module.
 *  Deliberately narrower than SubjectCreatePayload: only name/code are
 *  editable on that screen (see SubjectUpdate's docstring in
 *  app/schemas/academic.py for why levels aren't). */
export interface SubjectUpdatePayload {
  name: string;
  code: string;
}

/** PATCH /api/academic/subjects/{id}/status request body. */
export interface SubjectStatusUpdatePayload {
  is_active: boolean;
}

/**
 * Mirrors BatchSubjectOut in app/schemas/academic.py — one row of
 * GET /api/academic/batches/{batch_id}/offered-subjects. This is what
 * Student/Parent subject-request screens must read from (never the raw
 * `Subject` catalog via GET /academic/subjects), since it's the only
 * source that reflects what Admin has actually turned on for that batch.
 */
export interface BatchSubject {
  subject_id: string;
  subject_name: string;
  level_id: string;
  level_name: string;
  is_active: boolean;
}

/** Same shape as BatchSubject above — `manage-batch-dialog.component.ts`
 *  (Admin's "Offer Subjects / Assign Teacher" dialog) refers to this
 *  response as OfferedSubject rather than BatchSubject; kept as an alias
 *  instead of a duplicate interface so both names type-check against the
 *  exact same GET /batches/{batch_id}/offered-subjects response shape. */
export type OfferedSubject = BatchSubject;

/** Mirrors OfferSubjectsPayload in app/schemas/academic.py — the body for
 *  POST /academic/batches/{batch_id}/offered-subjects. is_active
 *  defaults true server-side too, but is required here since the Admin
 *  dialog always sends an explicit activate/deactivate call. */
export interface OfferSubjectsPayload {
  subject_ids: string[];
  is_active: boolean;
}

/** Mirrors AssignTeacherToBatchPayload in app/schemas/academic.py — the
 *  body for POST /academic/batches/{batch_id}/assign-teacher. batch_id
 *  itself comes from the URL, not this payload. */
export interface AssignTeacherToBatchPayload {
  subject_id: string;
  teacher_id: string;
}

// ---------------------------------------------------------------------------
// Batch Summary — powers the clickable Batch card/row's inline detail view
// (GET /api/v1/batches/{batch_id}/summary). Admin/Coordinator only.
// ---------------------------------------------------------------------------
export interface BatchSummaryTeacher {
  teacher_id: string;
  teacher_name: string;
  /** Subjects this teacher is assigned to teach WITHIN this batch. */
  subjects: string[];
}

export interface BatchSummarySubject {
  subject_id: string;
  subject_name: string;
  level_name: string; // 'O Level' | 'A Level'
  teacher_names: string[];
  active_student_count: number;
}

export interface BatchSummary {
  batch_id: string;
  batch_name: string;
  is_current: boolean;
  total_active_students: number;
  total_assigned_teachers: number;
  teachers: BatchSummaryTeacher[];
  /** Subjects with zero active enrollments AND zero teacher assignments
   *  in this batch are excluded entirely, per spec ("hide inactive
   *  subjects") — already filtered out server-side. */
  active_subjects: BatchSummarySubject[];
}

export interface StudentLevelEnrollment {
  id: string;
  student_id: string;
  level_id: string;
  status: LevelEnrollmentStatus;
  started_at: string;
  completed_at: string | null;
}

export interface SubjectRequest {
  id: string;
  student_id: string;
  subject_id: string;
  subject_name?: string; // convenience field the backend can join in for display
  batch_id: string;
  status: SubjectRequestStatus;
  requested_at: string;
  actioned_by: string | null;
  actioned_at: string | null;
}

export interface CreateSubjectRequest {
  subject_id: string;
  batch_id: string;
}

/** Coordinator/Admin review-queue row — GET /api/academic/subject-requests/review-queue, joined server-side. */
export interface SubjectRequestReviewRow {
  id: string;
  student_id: string;
  student_name: string;
  subject_id: string;
  subject_name: string;
  batch_id: string;
  batch_name: string;
  status: SubjectRequestStatus;
  requested_at: string;
  actioned_by: string | null;
  actioned_at: string | null;
}

export interface ReviewSubjectRequestPayload {
  status: 'approved' | 'rejected';
  comment?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  subject_id: string;
  subject_name?: string;
  batch_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
}

export interface TimetableEntry {
  id: string;
  subject_id: string;
  subject_name: string;
  teacher_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

/** Mirrors TimetableSlotDetailOut — used by the Teacher's own schedule
 *  (GET /api/timetable/my-teaching-schedule), distinct from TimetableEntry
 *  above which is the Student's enrollment-derived view. batch_name added
 *  Sub-Sprint 6.1 for the weekly grid's "Class Name" column. */
export interface TeachingScheduleEntry {
  id: string;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  batch_id: string;
  batch_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

export interface DashboardSummary {
  attendance_percentage: number;
  pending_assessments_count: number;
  current_batch_name: string | null;
  current_batch_year: number | null;
  active_subjects_count: number;
}
