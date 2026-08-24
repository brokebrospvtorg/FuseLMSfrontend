import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { TeacherWorkloadSummary } from '../models/teacher.model';

/**
 * Backend router is app/routers/teachers.py, mounted at /api/teachers —
 * deliberately separate from AcademicsStaffService's /api/academic
 * (teacher-assignments, batches, etc.) since this is a purpose-built
 * aggregate view for the Teachers sidebar page, not a general
 * academic-catalog endpoint.
 */
@Injectable({ providedIn: 'root' })
export class TeacherService {
  private readonly teachersUrl = `${APP_CONFIG.apiBaseUrl}/teachers`;

  constructor(private http: HttpClient) {}

  /** GET /api/teachers/workload-summary — Admin/Coordinator only
   *  server-side (require_roles). Returns every active teacher with their
   *  boards, levels, and active subject+batch assignments in one call —
   *  the Teachers list and its row-click detail drawer both read off this
   *  same response, no second request needed to open a row. */
  getWorkloadSummary(): Observable<TeacherWorkloadSummary[]> {
    return this.http.get<TeacherWorkloadSummary[]>(`${this.teachersUrl}/workload-summary`, {
      withCredentials: true,
    });
  }
}
