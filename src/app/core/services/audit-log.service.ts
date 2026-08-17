import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { AuditLogEntry } from '../models/academics-staff.model';

/**
 * Admin Sub-Sprint 2 — System Audit Log Widget.
 * Backend: GET /api/audit-logs (app/routers/audit.py), admin-only,
 * returns the 500 most recent rows across the whole system. That endpoint
 * already existed (used server-side for grade-override history lookups
 * elsewhere) but had no frontend caller until now.
 *
 * Reuses AuditLogEntry from academics-staff.model.ts rather than declaring
 * a duplicate interface — it already mirrors AuditLogOut field-for-field.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly apiBaseUrl = APP_CONFIG.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getAuditLogs(): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogEntry[]>(`${this.apiBaseUrl}/audit-logs`, { withCredentials: true });
  }
}
