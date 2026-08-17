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
}

export interface Level {
  id: string;
  name: string;
  display_order: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  level_id: string;
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
  period_number: number;
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
  period_number: number;
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
