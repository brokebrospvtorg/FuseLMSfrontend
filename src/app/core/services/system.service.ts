import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';

export interface ExpireBatchesResult {
  expired_count: number;
  expired_batches: { id: string; name: string }[];
}

/** Thin client for app/routers/system.py's Admin-only manual job
 *  triggers. Each job also runs on its own cron schedule server-side —
 *  these exist for on-demand runs (e.g. testing, or right after go-live)
 *  instead of waiting for the schedule. */
@Injectable({ providedIn: 'root' })
export class SystemService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/system`;

  constructor(private http: HttpClient) {}

  /** Soft-deletes any batch whose next standard batch's month has
   *  arrived, cascading to every table that references it. */
  triggerBatchExpiry(): Observable<ExpireBatchesResult> {
    return this.http.post<ExpireBatchesResult>(`${this.baseUrl}/jobs/expire-ended-batches`, {}, {
      withCredentials: true,
    });
  }
}
