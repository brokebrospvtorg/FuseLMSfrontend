import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { ParentChild, ParentChildOverview, ParentSubjectTranscript } from '../models/parent.model';

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
}
