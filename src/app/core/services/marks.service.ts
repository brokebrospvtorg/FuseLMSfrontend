import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { GradeReportEntry, SubjectMarksReport } from '../models/marks.model';

@Injectable({ providedIn: 'root' })
export class MarksService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/marks`;

  constructor(private http: HttpClient) {}

  getMyGradeReport(): Observable<GradeReportEntry[]> {
    return this.http.get<GradeReportEntry[]>(`${this.baseUrl}/me/grades`, { withCredentials: true });
  }

  getMyMarksForSubject(subjectId: string): Observable<SubjectMarksReport> {
    return this.http.get<SubjectMarksReport>(`${this.baseUrl}/me/marks/${subjectId}`, {
      withCredentials: true,
    });
  }
}
