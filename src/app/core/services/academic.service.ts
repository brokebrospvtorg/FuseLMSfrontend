import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { Subject, SubjectRequest, CreateSubjectRequest, TimetableEntry, DashboardSummary } from '../models/academic.model';

@Injectable({ providedIn: 'root' })
export class AcademicService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/academic`;

  constructor(private http: HttpClient) {}

  /** Subjects available for the logged-in student's active level(s), not yet requested. */
  getAvailableSubjects(): Observable<Subject[]> {
    return this.http.get<Subject[]>(`${this.baseUrl}/subjects/available`, { withCredentials: true });
  }

  getMySubjectRequests(): Observable<SubjectRequest[]> {
    return this.http.get<SubjectRequest[]>(`${this.baseUrl}/subject-requests/me`, { withCredentials: true });
  }

  submitSubjectRequest(payload: CreateSubjectRequest): Observable<SubjectRequest> {
    return this.http.post<SubjectRequest>(`${this.baseUrl}/subject-requests`, payload, {
      withCredentials: true,
    });
  }

  /**
   * NOTE: this is deliberately NOT under `this.baseUrl` (/api/academic) —
   * the backend mounts the timetable router separately at /api/timetable
   * (see routers/timetable.py), not nested under academic. Kept in this
   * service anyway since Timetable lives under the Academic tab in the UI.
   */
  getMyTimetable(): Observable<TimetableEntry[]> {
    return this.http.get<TimetableEntry[]>(`${APP_CONFIG.apiBaseUrl}/timetable/my-timetable`, {
      withCredentials: true,
    });
  }

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/dashboard/summary`, { withCredentials: true });
  }
}
