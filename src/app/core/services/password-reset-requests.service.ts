import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { PasswordResetRequestRow, ReviewPasswordResetRequestPayload } from '../models/auth.model';

/**
 * Admin Operations > Password Requests queue.
 * Backend: /api/admin/password-reset-requests (app/routers/password_requests.py)
 * — a deliberately separate top-level router from /api/auth, same reasoning
 * as ClassroomRequestsService being separate from the content router: this
 * is the Admin-review audience, not the logged-out submitter.
 */
@Injectable({ providedIn: 'root' })
export class PasswordResetRequestsService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/admin/password-reset-requests`;

  constructor(private http: HttpClient) {}

  listRequests(statusFilter?: 'pending' | 'approved' | 'rejected'): Observable<PasswordResetRequestRow[]> {
    let params = new HttpParams();
    if (statusFilter) params = params.set('status_filter', statusFilter);
    return this.http.get<PasswordResetRequestRow[]>(this.baseUrl, { params, withCredentials: true });
  }

  /** Approve resets the target's password to the fixed onboarding value
   *  server-side and forces must_change_password; reject leaves the
   *  account untouched. Either way notifies the requester server-side —
   *  nothing further to do here besides refreshing the list. */
  reviewRequest(
    requestId: string,
    payload: ReviewPasswordResetRequestPayload,
  ): Observable<PasswordResetRequestRow> {
    return this.http.patch<PasswordResetRequestRow>(`${this.baseUrl}/${requestId}/review`, payload, {
      withCredentials: true,
    });
  }
}
