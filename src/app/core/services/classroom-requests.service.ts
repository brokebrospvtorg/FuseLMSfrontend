import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { ClassroomEditRequest } from '../models/content.model';

export interface ReviewClassroomRequestPayload {
  status: 'approved' | 'rejected';
  review_note: string | null;
}

/**
 * Lectures Sub-Sprint 4 — Admin/Coordinator approval queue.
 * Backend: /api/classroom-requests (app/routers/content.py's
 * classroom_requests_router — a deliberately separate top-level router,
 * not nested under /api/content, matching the spec's stated path).
 * Kept as its own service rather than folded into TeacherContentService
 * for the same reason that one is separate from ContentService: this is
 * a structurally different audience (admin/coordinator review, not
 * teacher-owns-the-lecture) hitting a different base path entirely.
 */
@Injectable({ providedIn: 'root' })
export class ClassroomRequestsService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/classroom-requests`;

  constructor(private http: HttpClient) {}

  /** Task 2.1 / 4.1 — statusFilter omitted returns every request, any status;
   *  the queue view is expected to pass 'pending'. */
  listRequests(statusFilter?: 'pending' | 'approved' | 'rejected'): Observable<ClassroomEditRequest[]> {
    let params = new HttpParams();
    if (statusFilter) params = params.set('status_filter', statusFilter);
    return this.http.get<ClassroomEditRequest[]>(this.baseUrl, { params, withCredentials: true });
  }

  /** Task 2.2/4.3 — approve writes proposed_url into the live lecture
   *  server-side; reject leaves it untouched. Either way notifies the
   *  requesting Teacher server-side — nothing further to do here on
   *  success besides refreshing the list (Task 4.4). */
  reviewRequest(requestId: string, payload: ReviewClassroomRequestPayload): Observable<ClassroomEditRequest> {
    return this.http.patch<ClassroomEditRequest>(`${this.baseUrl}/${requestId}/review`, payload, {
      withCredentials: true,
    });
  }
}
