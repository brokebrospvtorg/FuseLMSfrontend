import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import {
  AttendanceRecord, AttendanceSummary, TeacherRosterEntry, TeacherDailyStatusEntry,
  TeacherDailyLogRequest, TeacherDailyLogResult, TeacherTimetableSlot, StudentAttendanceMarkRequest,
  PeriodRecord, CoordinatorRosterEntry, CoordinatorStudentOverrideRequest, TeacherAttendanceLogEntry,
  AdminTeacherAttendanceEntry, AdminTeacherAttendanceMarkRequest, AttendanceRecordWriteResult,
} from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/attendance`;

  constructor(private http: HttpClient) {}

  getMyAttendanceSummary(): Observable<AttendanceSummary[]> {
    return this.http.get<AttendanceSummary[]>(`${this.baseUrl}/me/summary`, { withCredentials: true });
  }

  /**
   * Backend auto-scopes this to the logged-in user for student/teacher
   * roles (see routers/attendance.py:list_attendance) — there's no
   * separate "/me/records" route, this IS the scoped route via the
   * root GET /api/attendance.
   */
  getMyAttendanceRecords(subjectId?: string, dateFrom?: string, dateTo?: string): Observable<AttendanceRecord[]> {
    let params = new HttpParams();
    if (subjectId) params = params.set('subject_id', subjectId);
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo) params = params.set('date_to', dateTo);

    return this.http.get<AttendanceRecord[]>(this.baseUrl, { params, withCredentials: true });
  }

  // --- Coordinator: Teacher Attendance Registry ---
  getTeacherRoster(): Observable<TeacherRosterEntry[]> {
    return this.http.get<TeacherRosterEntry[]>(`${this.baseUrl}/teachers/roster`, { withCredentials: true });
  }

  getTeacherDailyLog(date: string): Observable<TeacherDailyStatusEntry[]> {
    return this.http.get<TeacherDailyStatusEntry[]>(`${this.baseUrl}/teachers/daily-log`, {
      params: { date },
      withCredentials: true,
    });
  }

  saveTeacherDailyLog(payload: TeacherDailyLogRequest): Observable<TeacherDailyLogResult> {
    return this.http.post<TeacherDailyLogResult>(`${this.baseUrl}/teachers/daily-log`, payload, {
      withCredentials: true,
    });
  }

  // --- Teacher: marking their own students' attendance ---

  /**
   * Deliberately NOT under this.baseUrl (/api/attendance) — the backend
   * mounts the timetable router separately at /api/timetable (see
   * routers/timetable.py). GET /slots with no params auto-scopes to the
   * logged-in teacher's own periods server-side (list_slots checks
   * current_user.role == 'teacher'), same pattern AcademicService.getMyTimetable()
   * uses for the student side.
   */
  getMyTeachingSlots(): Observable<TeacherTimetableSlot[]> {
    return this.http.get<TeacherTimetableSlot[]>(`${APP_CONFIG.apiBaseUrl}/timetable/slots`, {
      withCredentials: true,
    });
  }

  markStudentAttendance(payload: StudentAttendanceMarkRequest): Observable<AttendanceRecord[]> {
    return this.http.post<AttendanceRecord[]>(`${this.baseUrl}/mark-students`, payload, {
      withCredentials: true,
    });
  }

  /** Sub-Sprint 3.2 — check if a period+date was already submitted, to
   *  drive the locked/read-only view (also used to inspect past dates). */
  getMyPeriodRecords(timetableSlotId: string, date: string): Observable<PeriodRecord[]> {
    return this.http.get<PeriodRecord[]>(`${this.baseUrl}/my-period-records`, {
      params: { timetable_slot_id: timetableSlotId, date },
      withCredentials: true,
    });
  }

  /** Day-Wise UI's "View Summary" — read-only historical log of classes
   *  this teacher has already taken, filtered by the compulsory
   *  Batch -> Level/Class -> Subject cascade (Board removed) — the
   *  Period/Date stage that follows is this same response, turned into
   *  cascading-filter options by the caller. dateFrom/dateTo remain
   *  available for callers that want a plain range instead. Backend caps
   *  date_to at today server-side regardless of what's passed here. */
  getMyAttendanceHistoryLog(
    subjectId?: string,
    levelId?: string,
    batchId?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Observable<TeacherAttendanceLogEntry[]> {
    let params = new HttpParams();
    if (subjectId) params = params.set('subject_id', subjectId);
    if (levelId) params = params.set('level_id', levelId);
    if (batchId) params = params.set('batch_id', batchId);
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo) params = params.set('date_to', dateTo);

    return this.http.get<TeacherAttendanceLogEntry[]>(`${this.baseUrl}/my-history-log`, {
      params,
      withCredentials: true,
    });
  }

  // --- Coordinator: Student Attendance override (bypasses the Teacher lock) ---

  getCoordinatorRoster(timetableSlotId: string, date: string): Observable<CoordinatorRosterEntry[]> {
    return this.http.get<CoordinatorRosterEntry[]>(`${this.baseUrl}/coordinator/roster`, {
      params: { timetable_slot_id: timetableSlotId, date },
      withCredentials: true,
    });
  }

  overrideStudentAttendance(payload: CoordinatorStudentOverrideRequest): Observable<AttendanceRecord[]> {
    return this.http.post<AttendanceRecord[]>(`${this.baseUrl}/coordinator/override-students`, payload, {
      withCredentials: true,
    });
  }

  // --- Admin: Teacher Attendance (View & Edit, cascading Batch -> Level
  // -> Subject scope, full parity with the Coordinator's own Day-Wise
  // view) ---

  /** One row per period on `date` matching the cascade filters, with the
   *  assigned teacher's own current attendance status (null = unmarked). */
  getAdminTeacherAttendance(
    date: string,
    batchId: string,
    levelId?: string,
    subjectId?: string,
  ): Observable<AdminTeacherAttendanceEntry[]> {
    let params = new HttpParams().set('date', date).set('batch_id', batchId);
    if (levelId) params = params.set('level_id', levelId);
    if (subjectId) params = params.set('subject_id', subjectId);

    return this.http.get<AdminTeacherAttendanceEntry[]>(`${this.baseUrl}/admin/teacher-attendance`, {
      params,
      withCredentials: true,
    });
  }

  /** Marks, edits, or overrides one teacher's attendance for one
   *  period+date. The backend requires `reason` whenever this changes an
   *  already-recorded status — see AdminTeacherAttendanceMarkRequest. */
  markOrOverrideAdminTeacherAttendance(payload: AdminTeacherAttendanceMarkRequest): Observable<AttendanceRecordWriteResult> {
    return this.http.post<AttendanceRecordWriteResult>(`${this.baseUrl}/admin/teacher-attendance`, payload, {
      withCredentials: true,
    });
  }
}