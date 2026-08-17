import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { YoutubeEditRequest } from '../models/content.model';

export interface ReviewYoutubeRequestPayload {
  status: 'approved' | 'rejected';
  review_note: string | null;
}

/**
 * Lectures Sub-Sprint 6 — Admin/Coordinator video-change approval queue.
 * Backend: /api/youtube-requests (app/routers/content.py's
 * youtube_requests_router — a separate top-level router, same reasoning
 * as ClassroomRequestsService: matches the spec's stated path exactly
 * rather than nesting under /api/content).
 *
 * Structurally identical to ClassroomRequestsService (same two endpoints,
 * same statusFilter convention) — kept as its own service rather than a
 * shared generic one for the same reason CoordinatorYoutubeRequestsComponent
 * is its own component rather than reusing CoordinatorClassroomRequestsComponent:
 * different backend router, different model shape (current_video_id vs
 * current_url), and this one drives an actual embedded video comparison,
 * not just a link diff.
 */
@Injectable({ providedIn: 'root' })
export class YoutubeRequestsService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/youtube-requests`;

  constructor(private http: HttpClient) {}

  listRequests(statusFilter?: 'pending' | 'approved' | 'rejected'): Observable<YoutubeEditRequest[]> {
    let params = new HttpParams();
    if (statusFilter) params = params.set('status_filter', statusFilter);
    return this.http.get<YoutubeEditRequest[]>(this.baseUrl, { params, withCredentials: true });
  }

  reviewRequest(requestId: string, payload: ReviewYoutubeRequestPayload): Observable<YoutubeEditRequest> {
    return this.http.patch<YoutubeEditRequest>(`${this.baseUrl}/${requestId}/review`, payload, {
      withCredentials: true,
    });
  }
}
