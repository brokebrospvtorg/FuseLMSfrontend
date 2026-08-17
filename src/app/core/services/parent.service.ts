import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import {
  ParentChild, ParentChildOverview, ParentSubjectTranscript,
  ParentAttendanceSummary, ParentTimetableEntry,
  ParentSubjectRequest, CreateParentSubjectRequest, ParentAvailableSubjects,
} from '../models/parent.model';

@Injectable({ providedIn: 'root' })
export class ParentService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/parent`;

  constructor(private http: HttpClient) {}

  getMyChildren(): Observable<ParentChild[]> {
    return this.http.get<ParentChild[]>(`${this.baseUrl}/children`, { withCredentials: true });
  }

  getChildOverview(studentId: string): Observable<ParentChildOverview> {
    return this.http.get<ParentChildOverview>(`${this.baseUrl}/child/${studentId}/overview`, {
      withCredentials: true,
    });
  }

  getChildReportCard(studentId: string): Observable<ParentSubjectTranscript[]> {
    return this.http.get<ParentSubjectTranscript[]>(`${this.baseUrl}/child/${studentId}/report-card`, {
      withCredentials: true,
    });
  }

  getChildAttendanceSummary(studentId: string): Observable<ParentAttendanceSummary> {
    return this.http.get<ParentAttendanceSummary>(`${this.baseUrl}/child/${studentId}/attendance-summary`, {
      withCredentials: true,
    });
  }

  getChildTimetable(studentId: string): Observable<ParentTimetableEntry[]> {
    return this.http.get<ParentTimetableEntry[]>(`${this.baseUrl}/child/${studentId}/timetable`, {
      withCredentials: true,
    });
  }

  getAvailableSubjectsForChild(studentId: string): Observable<ParentAvailableSubjects> {
    return this.http.get<ParentAvailableSubjects>(`${this.baseUrl}/child/${studentId}/available-subjects`, {
      withCredentials: true,
    });
  }

  getSubjectRequestsForChild(studentId: string): Observable<ParentSubjectRequest[]> {
    return this.http.get<ParentSubjectRequest[]>(`${this.baseUrl}/child/${studentId}/subject-requests`, {
      withCredentials: true,
    });
  }

  createSubjectRequestForChild(
    studentId: string,
    payload: CreateParentSubjectRequest,
  ): Observable<ParentSubjectRequest> {
    return this.http.post<ParentSubjectRequest>(
      `${this.baseUrl}/child/${studentId}/subject-requests`,
      payload,
      { withCredentials: true },
    );
  }
}
