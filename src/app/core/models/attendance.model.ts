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

/** GET /api/attendance/my-history-log — Day-Wise UI's "View Summary" modal.
 *  One row per period+date the teacher has already taken (today or
 *  earlier), with the student attendance breakdown for that class. */
export interface TeacherAttendanceLogEntry {
  date: string;
  timetable_slot_id: string;
  start_time: string;
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
  start_time: string;
  end_time: string;
}

/** Board removed: TimetableSlotCreate (backend) never accepted a `board`
 *  field to begin with — the field this interface used to carry was a
 *  holdover from before the Board entity was dropped entirely. Omitted
 *  here rather than sent-and-ignored. */
export interface CreateTimetableSlotRequest {
  level_id: string;
  subject_id: string;
  teacher_id: string;
  batch_id: string;
  day_of_week: string;
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
  start_time?: string;
  end_time?: string;
}

// --- Admin: Teacher Attendance (View & Edit, full Coordinator parity) ---

/** GET /api/attendance/admin/teacher-attendance — one row per period on
 *  the selected date, matching the Batch -> Level -> Subject cascade
 *  (Board removed), with the assigned teacher's own attendance status for
 *  that period+date (null fields = never marked yet at all). */
export interface AdminTeacherAttendanceEntry {
  timetable_slot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  batch_id: string;
  batch_name: string;
  level_id: string;
  level_code: string | null;
  subject_id: string;
  subject_name: string;
  teacher_id: string;
  teacher_name: string;
  // Non-null on every field below iff this period+date has already been
  // recorded at all — the screen requires reason when editing to a
  // different status than what's already saved here.
  attendance_record_id: string | null;
  status: AttendanceStatus | null;
  source: string | null;
  marked_by: string | null;
  marked_at: string | null;
}

/** POST /api/attendance/admin/teacher-attendance — mark, edit, or
 *  override one teacher's attendance for one period+date. `reason` is
 *  required by the backend when this changes an existing record's
 *  status; optional for a first-time mark. */
export interface AdminTeacherAttendanceMarkRequest {
  timetable_slot_id: string;
  subject_id: string;
  teacher_user_id: string;
  date: string;
  status: AttendanceStatus;
  reason?: string;
}

/** Mirrors AttendanceRecordOut — the raw row shape POST
 *  /admin/teacher-attendance returns (unjoined, unlike AttendanceRecord
 *  above which carries a joined subject_name). */
export interface AttendanceRecordWriteResult {
  id: string;
  user_id: string;
  subject_id: string;
  timetable_slot_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: string;
  source: string;
  marked_at: string;
}