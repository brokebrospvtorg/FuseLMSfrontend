import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { APP_CONFIG } from '../config/app-config';
import { Batch, Level, Subject, BatchSubject, SubjectRequest, CreateSubjectRequest, TimetableEntry, DashboardSummary } from '../models/academic.model';

@Injectable({ providedIn: 'root' })
export class AcademicService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/academic`;

  constructor(private http: HttpClient) {}

  /**
   * The single Batch with is_current = true. GET /academic/batches is
   * available to any authenticated role (see list_batches in
   * routers/academic.py) and every BatchOut carries is_current, so this
   * is the same "current batch" resolution the backend itself uses
   * (dashboard_summary, parent.py's child_available_subjects) — no
   * separate /batches/current endpoint exists, and none is needed.
   */
  getCurrentBatch(): Observable<Batch | undefined> {
    return this.http
      .get<Batch[]>(`${this.baseUrl}/batches`, { withCredentials: true })
      .pipe(map((batches) => batches.find((b) => b.is_current)));
  }

  /**
   * Subjects explicitly offered (batch_subjects.is_active = true) for a
   * given batch — the ONLY source Student/Parent subject-request screens
   * (and the Admin Registry's Student Edit Details subject picker) may
   * read from. Replaces the old GET /academic/subjects/available, which
   * was never implemented on the backend and always 404'd ("Could not
   * load available subjects right now").
   *
   * `board` is optional and narrows to offerings under one examining
   * Board (schema_update_15 — the same batch/subject can be offered more
   * than once, once per board). Omitting it returns offerings across
   * every board, same as calling GET .../offered-subjects with no query
   * param at all — callers that know which board they care about (e.g. a
   * Student's own registered board) should always pass it rather than
   * filtering the unfiltered list client-side, per that endpoint's own
   * docstring.
   */
  getOfferedSubjects(batchId: string, board?: string): Observable<BatchSubject[]> {
    const url = board
      ? `${this.baseUrl}/batches/${batchId}/offered-subjects?board=${encodeURIComponent(board)}`
      : `${this.baseUrl}/batches/${batchId}/offered-subjects`;
    return this.http.get<BatchSubject[]>(url, { withCredentials: true });
  }

  /**
   * Replaces the old GET /academic/subject-requests/me, which likewise
   * never existed on the backend. The real endpoint is GET
   * /academic/subject-requests — it already scopes to the caller's own
   * requests server-side when current_user.role === 'student' (see
   * list_subject_requests), so no query param is needed here.
   */
  getMySubjectRequests(): Observable<SubjectRequest[]> {
    return this.http.get<SubjectRequest[]>(`${this.baseUrl}/subject-requests`, { withCredentials: true });
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

  /** All academic levels (O-Level, A-Level, etc.) — used to populate the
   *  Admin Registry's level picker (GET /api/academic/levels). */
  getLevels(): Observable<Level[]> {
    return this.http.get<Level[]>(`${this.baseUrl}/levels`, { withCredentials: true });
  }

  /** Subjects, optionally scoped to a single level. Passing `levelId` is
   *  what keeps the Admin Registry's subject multi-select limited to only
   *  the subjects that belong to the currently-selected level. */
  getSubjects(levelId?: string): Observable<Subject[]> {
    const url = levelId ? `${this.baseUrl}/subjects?level_id=${levelId}` : `${this.baseUrl}/subjects`;
    return this.http.get<Subject[]>(url, { withCredentials: true });
  }
}
