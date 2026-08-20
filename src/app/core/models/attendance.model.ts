import { AttendanceStatus, Board } from './enums';

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
  // DB level code (e.g. "AS-LEVEL") for the level badge — see
  // shared/utils/level-badge.util.ts::getLevelAbbreviation(). Null if unset.
  level_code: string | null;
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

/** Mirrors TimetableSlotOut/TimetableSlotDetailOut — the teacher's own
 *  periods, unresolved names (subject/batch names are looked up
 *  client-side against AcademicsStaffService, same pattern as the Marks
 *  screen's class picker). */
export interface TeacherTimetableSlot {
  id: string;
  subject_id: string;
  teacher_id: string;
  batch_id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  // Over-Inclusive Cascading Dropdowns fix: the active batch_subjects
  // board this slot's subject+batch is actually offered under, resolved
  // server-side — see TimetableSlotDetailOut.board's docstring in
  // app/schemas/attendance.py. GET /timetable/slots (Teacher-scoped) and
  // GET /timetable/my-teaching-schedule fan one slot out into one row per
  // active board, so the same period can appear more than once here, each
  // with a different board — that's expected, not a duplicate.
  board: Board;
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

/** GET /api/attendance/my-history-log — Day-Wise UI's "View Summary" modal.
 *  One row per period+date the teacher has already taken (today or
 *  earlier), with the student attendance breakdown for that class. */
export interface TeacherAttendanceLogEntry {
  date: string;
  timetable_slot_id: string;
  period_number: number;
  subject_id: string;
  subject_name: string;
  level_code: string | null;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  total_students: number;
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
