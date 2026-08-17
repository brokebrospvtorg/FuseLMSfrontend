import { AttendanceStatus } from './enums';

/** Mirrors app/models/attendance.py */

export interface AttendanceRecord {
  id: string;
  subject_id: string;
  subject_name: string;
  date: string;
  status: AttendanceStatus;
  timetable_slot_id: string;
}

export interface AttendanceSummary {
  subject_id: string;
  subject_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  total_periods: number;
  attendance_percentage: number;
}

/** Coordinator's Teacher Attendance Registry — GET /api/attendance/teachers/roster */
export interface TeacherRosterEntry {
  id: string;
  full_name: string;
}

/** GET /api/attendance/teachers/daily-log?date=... */
export interface TeacherDailyStatusEntry {
  teacher_user_id: string;
  full_name: string;
  period_count: number;
  status: AttendanceStatus | null; // null = no periods that day, or periods disagree
}

export interface TeacherDailyLogEntry {
  teacher_user_id: string;
  status: AttendanceStatus;
}

export interface TeacherDailyLogRequest {
  date: string;
  entries: TeacherDailyLogEntry[];
}

export interface TeacherDailyLogSkipped {
  teacher_user_id: string;
  reason: string;
}

export interface TeacherDailyLogResult {
  updated_teacher_ids: string[];
  skipped: TeacherDailyLogSkipped[];
}

// --- Teacher marking their own students' attendance (Sub-Sprint 8.1) ---

/** Mirrors TimetableSlotOut — the teacher's own periods, unresolved names
 *  (subject/batch names are looked up client-side against AcademicsStaffService,
 *  same pattern as the Marks screen's class picker). */
export interface TeacherTimetableSlot {
  id: string;
  subject_id: string;
  teacher_id: string;
  batch_id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
}

export interface StudentAttendanceMarkItem {
  student_user_id: string;
  status: AttendanceStatus;
}

export interface StudentAttendanceMarkRequest {
  timetable_slot_id: string;
  subject_id: string;
  date: string;
  records: StudentAttendanceMarkItem[];
}

/** GET /api/attendance/my-period-records — Sub-Sprint 3.2 lock/historical check */
export interface PeriodRecord {
  student_user_id: string;
  status: AttendanceStatus;
  marked_at: string;
}

// --- Coordinator: Student Attendance override (Coordinator Portal Sub-Sprint 3) ---

/** GET /api/attendance/coordinator/roster — one row per enrolled student,
 *  status null if nothing recorded for this slot+date yet at all. */
export interface CoordinatorRosterEntry {
  student_user_id: string;
  full_name: string;
  status: AttendanceStatus | null;
}

export interface CoordinatorStudentOverrideRequest {
  timetable_slot_id: string;
  subject_id: string;
  date: string;
  records: StudentAttendanceMarkItem[];
}

// --- Timetable Builder (Coordinator Portal Sub-Sprint 3) ---

/** Mirrors TimetableSlotDetailOut — joined names for the builder grid. */
export interface TimetableSlotDetail {
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

export interface CreateTimetableSlotRequest {
  level_id: string;
  subject_id: string;
  teacher_id: string;
  batch_id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
}

/** Every field optional — PATCH sends only what's changing. */
export interface UpdateTimetableSlotRequest {
  level_id?: string;
  subject_id?: string;
  teacher_id?: string;
  batch_id?: string;
  day_of_week?: string;
  period_number?: number;
  start_time?: string;
  end_time?: string;
}
