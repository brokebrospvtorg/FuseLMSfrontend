import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { TeacherWorkloadSummary, TeacherAssignmentCreatePayload } from '../models/teacher.model';
import { TeacherAssignment } from '../models/academics-staff.model';

/**
 * Backend router is app/routers/teachers.py, mounted at /api/teachers —
 * deliberately separate from AcademicsStaffService's /api/academic
 * (teacher-assignments, batches, etc.) since this is a purpose-built
 * aggregate view for the Teachers sidebar page, not a general
 * academic-catalog endpoint.
 *
 * Workload Management (assignToTeacher / removeAssignment below) lives
 * here too, not on AcademicsStaffService, even though it writes/soft-
 * deletes the exact same teacher_subject_assignments row the /api/academic
 * endpoints do — there's only ever one table. It's teacher-scoped
 * (mounted under /api/teachers/{teacher_id}/...) because it's the
 * Teachers sidebar's own "manage this teacher's workload" action, so
 * teacher_id belongs in the URL, not repeated in every request body. A
 * change made through either surface shows up immediately in the other
 * (workload-summary, GET /api/academic/teacher-assignments, the Registry,
 * Timetable Builder's Teacher Assignee dropdown) — no separate sync step.
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

  /**
   * POST /api/teachers/{teacher_id}/assignments — Manage Teacher's "Add
   * Assignment" form. Admin/Coordinator only server-side. The backend
   * validates the subject actually has an ACTIVE offering for the picked
   * batch (400 otherwise) and 409s on a duplicate active assignment — the
   * dialog is expected to source its Subject dropdown from
   * AcademicsStaffService.getOfferedSubjects(batchId) so a 400 here should
   * only ever happen on stale dropdown data, not a normal picking flow.
   *
   * Response mirrors TeacherSubjectAssignmentOut — same shape as
   * AcademicsStaffService's teacher-assignment calls, so it's typed as the
   * shared TeacherAssignment model rather than a duplicate interface.
   */
  assignToTeacher(teacherId: string, payload: TeacherAssignmentCreatePayload): Observable<TeacherAssignment> {
    return this.http.post<TeacherAssignment>(
      `${this.teachersUrl}/${teacherId}/assignments`,
      payload,
      { withCredentials: true },
    );
  }

  /**
   * DELETE /api/teachers/{teacher_id}/assignments/{assignment_id} —
   * Manage Teacher's "Remove" row action. Admin/Coordinator only
   * server-side. Soft-deletes the assignment (204, no body) — it
   * immediately drops out of workload-summary and every other
   * active-assignment read, but the row itself (and its audit trail)
   * stays for history. assignment_id must belong to teacherId or the
   * backend 404s, same as a nonexistent id.
   */
  removeAssignment(teacherId: string, assignmentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.teachersUrl}/${teacherId}/assignments/${assignmentId}`,
      { withCredentials: true },
    );
  }
}
