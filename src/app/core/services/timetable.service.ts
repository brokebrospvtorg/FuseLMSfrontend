import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { TimetableSlotDetail, CreateTimetableSlotRequest, UpdateTimetableSlotRequest } from '../models/attendance.model';

/**
 * Interactive Timetable Builder (Coordinator Portal Sub-Sprint 3). All
 * three endpoints already existed for create+delete — the PATCH (edit) was
 * the missing one, added alongside this service. Deliberately its own
 * service rather than folding into AttendanceService/AcademicService,
 * since neither owns timetable data — timetable.py is its own router.
 */
@Injectable({ providedIn: 'root' })
export class TimetableService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/timetable`;

  constructor(private http: HttpClient) {}

  getSlots(batchId?: string, teacherId?: string): Observable<TimetableSlotDetail[]> {
    let params = new HttpParams();
    if (batchId) params = params.set('batch_id', batchId);
    if (teacherId) params = params.set('teacher_id', teacherId);
    return this.http.get<TimetableSlotDetail[]>(`${this.baseUrl}/slots`, { params, withCredentials: true });
  }

  createSlot(payload: CreateTimetableSlotRequest): Observable<TimetableSlotDetail> {
    return this.http.post<TimetableSlotDetail>(`${this.baseUrl}/slots`, payload, { withCredentials: true });
  }

  updateSlot(slotId: string, payload: UpdateTimetableSlotRequest): Observable<TimetableSlotDetail> {
    return this.http.patch<TimetableSlotDetail>(`${this.baseUrl}/slots/${slotId}`, payload, { withCredentials: true });
  }

  deleteSlot(slotId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/slots/${slotId}`, { withCredentials: true });
  }
}
