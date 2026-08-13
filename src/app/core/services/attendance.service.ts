import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import {
  AttendanceRecord, AttendanceSummary, TeacherRosterEntry, TeacherDailyStatusEntry,
  TeacherDailyLogRequest, TeacherDailyLogResult, TeacherTimetableSlot, StudentAttendanceMarkRequest,
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
}
