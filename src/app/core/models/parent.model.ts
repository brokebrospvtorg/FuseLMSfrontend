/** Mirrors app/schemas/parent.py */

import { Subject } from './academic.model';

// Pehle agar MarkEntry kisi aur file (jaise student ya teacher model) mein hai to yahan import kar lein, 
// nahi to niche humne inline define kar diya hai.

export interface MarkEntry {
  evaluation_type_name: string; // e.g., 'Quiz 1', 'Midterm', 'Assignment 2'
  obtained_marks: number;
  total_marks: number;
  weightage_percentage?: number; 
  remarks?: string | null;
}

export interface ParentChild {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  relationship: string | null;
}

export interface ParentChildOverview {
  student_id: string;
  full_name: string;
  current_batch_name: string | null;
  current_batch_year: number | null;
  overall_attendance_percentage: number | null;
  aggregate_grade_percentage: number | null;
}

export interface ParentSubjectTranscript {
  subject_id: string;
  subject_name: string;
  computed_percentage: number | null;
  letter_grade: string | null;
  is_overridden: boolean;
  assessments: MarkEntry[];
}
/** Mirrors app/schemas/parent.py's new attendance-summary + timetable additions */

export interface ParentSubjectAttendance {
  subject_id: string;
  subject_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  total_periods: number;
  attendance_percentage: number;
}

export interface ParentAttendanceActivity {
  date: string;
  subject_name: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

export interface ParentAttendanceSummary {
  student_id: string;
  overall_present_count: number;
  overall_absent_count: number;
  overall_late_count: number;
  overall_excused_count: number;
  overall_total_periods: number;
  overall_attendance_percentage: number | null;
  by_subject: ParentSubjectAttendance[];
  recent_activity: ParentAttendanceActivity[];
}

/** No room_number — timetable_slots has no room column in the schema. */
export interface ParentTimetableEntry {
  id: string;
  subject_id: string;
  subject_name: string;
  teacher_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

/** Mirrors ParentAvailableSubjectsOut in app/schemas/parent.py. batch_id
 *  here is the batch this list was computed against — submit THIS value
 *  with the request, never a separately-fetched "current batch". */
export interface ParentAvailableSubjects {
  batch_id: string | null;
  batch_name: string | null;
  subjects: Subject[];
}

/** Mirrors ParentSubjectRequestOut / ParentSubjectRequestCreate in
 *  app/schemas/parent.py */
export interface ParentSubjectRequest {
  id: string;
  subject_id: string;
  subject_name: string;
  batch_id: string;
  batch_name: string;
  status: 'requested' | 'approved' | 'rejected';
  requested_at: string;
  actioned_at: string | null;
}

/** reason is NOT persisted as its own column — subject_requests has no
 *  such field in the schema. It's folded into the notification sent to
 *  reviewers instead. See ParentSubjectRequestCreate in schemas/parent.py. */
export interface CreateParentSubjectRequest {
  subject_id: string;
  batch_id: string;
  reason?: string;
}
