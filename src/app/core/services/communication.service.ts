import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { Complaint, CreateComplaint, Notification } from '../models/communication.model';

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  // NOTE: backend routers are mounted directly at /api/complaints and
  // /api/notifications (see app/routers/complaints.py and notifications.py)
  // — there's no /communication prefix and no /me suffix, since both list
  // endpoints already filter to the current user server-side. The previous
  // version of this service pointed at /api/communication/complaints/me and
  // /api/communication/notifications/me, which don't exist on the backend
  // at all — every call here was 404ing.
  private readonly apiBaseUrl = APP_CONFIG.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getMyComplaints(): Observable<Complaint[]> {
    return this.http.get<Complaint[]>(`${this.apiBaseUrl}/complaints`, { withCredentials: true });
  }

  submitComplaint(payload: CreateComplaint): Observable<Complaint> {
    return this.http.post<Complaint>(`${this.apiBaseUrl}/complaints`, payload, { withCredentials: true });
  }

  getMyNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiBaseUrl}/notifications`, { withCredentials: true });
  }

  markNotificationRead(id: string): Observable<Notification> {
    return this.http.patch<Notification>(
      `${this.apiBaseUrl}/notifications/${id}/read`,
      {},
      { withCredentials: true },
    );
  }
}
