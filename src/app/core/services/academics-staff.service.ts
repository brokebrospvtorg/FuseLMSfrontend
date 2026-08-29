import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import {
  Subject, Batch, Level, SubjectRequestReviewRow, ReviewSubjectRequestPayload,
  TeachingScheduleEntry, Enrollment, GeneratedBatchTemplate, CreateBatchPayload, UpdateBatchPayload,
  BatchSummary, OfferedSubject, OfferSubjectsPayload, AssignTeacherToBatchPayload,
  SubjectCreatePayload, SubjectUpdatePayload, SubjectStatusUpdatePayload,
} from '../models/academic.model';
import {
  AssessmentFull, CreateAssessmentRequest, UpdateAssessmentRequest, RosterEntry, MarkUpsertPayload, MarkFull,
  GradeFull, MarkOverridePayload, TeacherAssignment, AuditLogEntry,
  CreateMarkEditRequestPayload, MarkEditRequestFull, ReviewMarkEditRequestPayload,
} from '../models/academics-staff.model';

/**
 * Backend router for this service is app/routers/marks.py, mounted at
 * /api/academics (note: plural "academics", NOT the /api/academic used by
 * AcademicService — two separate routers, deliberately). Subject/batch/
 * teacher-assignment lookups below still hit /api/academic since that's
 * where academic.py actually lives.
 */
@Injectable({ providedIn: 'root' })
export class AcademicsStaffService {
  private readonly marksUrl = `${APP_CONFIG.apiBaseUrl}/academics`;
  private readonly academicUrl = `${APP_CONFIG.apiBaseUrl}/academic`;
  private readonly timetableUrl = `${APP_CONFIG.apiBaseUrl}/timetable`;
  // app/routers/batches.py is deliberately mounted at /api/v1/batches, not
  // nested under /api/academic — see that router's own module docstring.
  private readonly batchesV1Url = `${APP_CONFIG.apiBaseUrl}/v1/batches`;

  constructor(private http: HttpClient) {}

  /** The teacher's own weekly schedule (GET /api/timetable/my-teaching-schedule) —
   *  every slot where they're the assigned teacher, across all subjects/batches. */
  /** dayOfWeek omitted returns the full week (unchanged default); passed,
   *  filters server-side to just that day — the Teacher Timetable
   *  screen's day-tab filter uses this instead of filtering the already-
   *  fetched full week client-side, so switching days is a real request
   *  rather than a stale local filter once the week's data goes stale. */
  getMyTeachingSchedule(dayOfWeek?: string): Observable<TeachingScheduleEntry[]> {
    let params = new HttpParams();
    if (dayOfWeek) params = params.set('day_of_week', dayOfWeek);
    return this.http.get<TeachingScheduleEntry[]>(`${this.timetableUrl}/my-teaching-schedule`, {
      params,
      withCredentials: true,
    });
  }

  // --- Pickers (level / subject / batch / my assignments) ---
  getLevels(): Observable<Level[]> {
    return this.http.get<Level[]>(`${this.academicUrl}/levels`, { withCredentials: true });
  }

  /** includeInactive: pass true only from the Admin Subjects management
   *  screen — it needs to see (and re-activate) deactivated subjects.
   *  Every other caller should leave this false/omitted so pickers keep
   *  showing active subjects only (see list_subjects in
   *  routers/academic.py for why the default has to stay false). */
  getSubjects(levelId?: string, includeInactive = false): Observable<Subject[]> {
    const params: Record<string, string> = {};
    if (levelId) params['level_id'] = levelId;
    if (includeInactive) params['include_inactive'] = 'true';
    return this.http.get<Subject[]>(`${this.academicUrl}/subjects`, { params, withCredentials: true });
  }

  /** activeOnly (default false) passes through to the backend's
   *  active_only query param — leave it unset for callers that need
   *  every batch (Admin Batches screen, Add Teacher cascade); pass true
   *  for pickers that should only ever offer a currently-active batch
   *  (Add Student "Initial Enrollment" cascade). */
  getBatches(activeOnly = false): Observable<Batch[]> {
    let params = new HttpParams();
    if (activeOnly) {
      params = params.set('active_only', 'true');
    }
    return this.http.get<Batch[]>(`${this.academicUrl}/batches`, { params, withCredentials: true });
  }

  /** schema_update_16 — POST /academic/subjects. Admin/Coordinator only
   *  server-side; case-insensitive name/code duplicate check happens on
   *  the backend (400 on conflict), not here. */
  createSubject(payload: SubjectCreatePayload): Observable<Subject> {
    return this.http.post<Subject>(`${this.academicUrl}/subjects`, payload, { withCredentials: true });
  }

  /** Admin Subjects module — PUT /academic/subjects/{id}. Admin-only
   *  server-side (see app/routers/subjects.py:update_subject); same
   *  case-insensitive name/code duplicate check as create, 400 on
   *  conflict. */
  updateSubject(subjectId: string, payload: SubjectUpdatePayload): Observable<Subject> {
    return this.http.put<Subject>(`${this.academicUrl}/subjects/${subjectId}`, payload, { withCredentials: true });
  }

  /** Admin Subjects module — PATCH /academic/subjects/{id}/status.
   *  Activate/Deactivate, Admin-only server-side. Reversible — see
   *  SubjectStatusUpdate's docstring in app/schemas/academic.py. */
  setSubjectStatus(subjectId: string, payload: SubjectStatusUpdatePayload): Observable<Subject> {
    return this.http.patch<Subject>(`${this.academicUrl}/subjects/${subjectId}/status`, payload, {
      withCredentials: true,
    });
  }

  /** Admin Subjects module — DELETE /academic/subjects/{id}. Admin-only
   *  server-side, and the backend itself refuses (409) if the subject is
   *  still referenced by any batch offering, enrollment, teacher
   *  assignment, or subject request — see delete_subject's dependency
   *  check in app/routers/subjects.py. The caller is expected to surface
   *  err.error.detail from that 409 rather than re-deriving the reason
   *  client-side. */
  deleteSubject(subjectId: string): Observable<void> {
    return this.http.delete<void>(`${this.academicUrl}/subjects/${subjectId}`, { withCredentials: true });
  }

  /** The Batch Generator's standard 5-year window (current year + 4
   *  ahead), each entry flagged with whether it's already been created —
   *  Admin/Coordinator only. Powers the "Create Batch" dropdown so only
   *  standardized, not-yet-existing session/year combinations are ever
   *  offered, instead of a free-typed session or year. */
  getGeneratedBatchTemplates(): Observable<GeneratedBatchTemplate[]> {
    return this.http.get<GeneratedBatchTemplate[]>(`${this.academicUrl}/batches/generate`, {
      withCredentials: true,
    });
  }

  createBatch(payload: CreateBatchPayload): Observable<Batch> {
    return this.http.post<Batch>(`${this.academicUrl}/batches`, payload, { withCredentials: true });
  }

  /** PUT /academic/batches/{batch_id} — corrects a batch's exam session
   *  and/or target year after creation (see UpdateBatchPayload; `board`
   *  used to be the only editable field here, removed along with the
   *  Board entity). */
  updateBatch(batchId: string, payload: UpdateBatchPayload): Observable<Batch> {
    return this.http.put<Batch>(`${this.academicUrl}/batches/${batchId}`, payload, { withCredentials: true });
  }

  setCurrentBatch(batchId: string): Observable<Batch> {
    return this.http.patch<Batch>(`${this.academicUrl}/batches/${batchId}/set-current`, {}, {
      withCredentials: true,
    });
  }

  /**
   * schema_update_13's Batch.is_active toggle (PATCH
   * /academic/batches/{batch_id}/set-active) — "is this batch open for
   * admin work", independent of is_current. The backend takes is_active
   * as a query param, not a body (see set_batch_active in
   * routers/academic.py: `is_active: bool` with no Pydantic model), so
   * it's passed via `params` here, not the request body.
   */
  setBatchActive(batchId: string, isActive: boolean): Observable<Batch> {
    return this.http.patch<Batch>(`${this.academicUrl}/batches/${batchId}/set-active`, {}, {
      params: { is_active: String(isActive) },
      withCredentials: true,
    });
  }

  /** Subjects explicitly offered (batch_subjects.is_active = true) for
   *  this batch — GET /academic/batches/{batch_id}/offered-subjects. Any
   *  authenticated role can call this server-side; used here for the
   *  Admin "Manage Subjects & Teachers" dialog's Assign-Teacher source
   *  list (see that dialog's own docstring for why it's a second,
   *  narrower list than getSubjects() above). */
  getOfferedSubjects(batchId: string): Observable<OfferedSubject[]> {
    return this.http.get<OfferedSubject[]>(`${this.academicUrl}/batches/${batchId}/offered-subjects`, {
      withCredentials: true,
    });
  }

  /** Activates (or, with is_active: false, deactivates) one or more
   *  catalog subjects for this batch — POST
   *  /academic/batches/{batch_id}/offered-subjects. Same endpoint upserts
   *  a batch_subjects row per subject_id either direction; the dialog
   *  calls this once per direction when a Save mixes activations and
   *  deactivations (see ManageBatchDialogComponent.saveOfferedSubjects). */
  offerSubjects(batchId: string, payload: OfferSubjectsPayload): Observable<OfferedSubject[]> {
    return this.http.post<OfferedSubject[]>(`${this.academicUrl}/batches/${batchId}/offered-subjects`, payload, {
      withCredentials: true,
    });
  }

  /** Links a teacher to a subject within this batch — POST
   *  /academic/batches/{batch_id}/assign-teacher. Writes the same
   *  TeacherSubjectAssignment row as the generic
   *  POST /academic/teacher-assignments, so it shows up immediately in
   *  the Information Registry with no separate sync step. */
  assignTeacherToBatch(batchId: string, payload: AssignTeacherToBatchPayload): Observable<TeacherAssignment> {
    return this.http.post<TeacherAssignment>(`${this.academicUrl}/batches/${batchId}/assign-teacher`, payload, {
      withCredentials: true,
    });
  }

  /** Aggregated summary for the clickable Batch card/row's inline detail
   *  view (drawer/modal) — GET /api/v1/batches/{batch_id}/summary.
   *  Strictly Admin/Coordinator server-side (require_roles). */
  getBatchSummary(batchId: string): Observable<BatchSummary> {
    return this.http.get<BatchSummary>(`${this.batchesV1Url}/${batchId}/summary`, {
      withCredentials: true,
    });
  }

  /** Server-side filters to "my own" when the caller is a Teacher. */
  getMyTeacherAssignments(): Observable<TeacherAssignment[]> {
    return this.http.get<TeacherAssignment[]>(`${this.academicUrl}/teacher-assignments`, { withCredentials: true });
  }

  /**
   * Explicit teacher_id variant of getMyTeacherAssignments(), for a
   * caller whose own account role isn't "teacher" but who still needs
   * to check one specific teacher_id's assignments — currently just the
   * Dual-Role Switcher (RoleSwitchService), asking "does this
   * Coordinator have any teaching assignments of their own". Backend
   * accepts teacher_id from any authenticated role (get_current_user,
   * not require_roles) so this is a plain filtered GET, same endpoint
   * getMyTeacherAssignments() already uses.
   */
  getTeacherAssignmentsFor(teacherId: string): Observable<TeacherAssignment[]> {
    return this.http.get<TeacherAssignment[]>(`${this.academicUrl}/teacher-assignments`, {
      withCredentials: true,
      params: { teacher_id: teacherId },
    });
  }

  /**
   * Cascading-dropdown support for the Coordinator's Interactive Timetable
   * Builder: GET /academic/teacher-assignments already accepts
   * subject_id/batch_id filters (added for exactly this pattern — see that
   * endpoint's own docstring). Used to populate the Teacher Assignee
   * stage with only teachers actually assigned to
   * teach the cascade's selected Subject within its selected Batch,
   * instead of every teacher in the registry.
   */
  getTeacherAssignments(subjectId?: string, batchId?: string): Observable<TeacherAssignment[]> {
    const params: Record<string, string> = {};
    if (subjectId) params['subject_id'] = subjectId;
    if (batchId) params['batch_id'] = batchId;
    return this.http.get<TeacherAssignment[]>(`${this.academicUrl}/teacher-assignments`, {
      params,
      withCredentials: true,
    });
  }

  /**
   * Cascading-dropdown support: students actually enrolled in a subject.
   * Used to filter the Student picker in Admin Fee Structures so a
   * subject-specific fee can only be set for a student really taking that
   * subject, instead of every student in the system.
   */
  getEnrollmentsBySubject(subjectId: string): Observable<Enrollment[]> {
    return this.http.get<Enrollment[]>(`${this.academicUrl}/enrollments`, {
      params: { subject_id: subjectId },
      withCredentials: true,
    });
  }

  // --- Roster ---
  getRoster(subjectId: string, batchId: string): Observable<RosterEntry[]> {
    return this.http.get<RosterEntry[]>(`${this.marksUrl}/roster`, {
      params: { subject_id: subjectId, batch_id: batchId },
      withCredentials: true,
    });
  }

  // --- Assessments ---
  getAssessments(subjectId: string, batchId: string): Observable<AssessmentFull[]> {
    return this.http.get<AssessmentFull[]>(`${this.marksUrl}/assessments`, {
      params: { subject_id: subjectId, batch_id: batchId },
      withCredentials: true,
    });
  }

  createAssessment(payload: CreateAssessmentRequest): Observable<AssessmentFull> {
    return this.http.post<AssessmentFull>(`${this.marksUrl}/assessments`, payload, { withCredentials: true });
  }

  publishAssessment(assessmentId: string): Observable<AssessmentFull> {
    return this.http.post<AssessmentFull>(`${this.marksUrl}/assessments/${assessmentId}/publish`, {}, {
      withCredentials: true,
    });
  }

  /** Coordinator/Admin direct edit — bypasses the Teacher lock. See
   *  AssessmentUpdate's docstring for why this is narrower than create. */
  updateAssessment(assessmentId: string, payload: UpdateAssessmentRequest): Observable<AssessmentFull> {
    return this.http.patch<AssessmentFull>(`${this.marksUrl}/assessments/${assessmentId}`, payload, {
      withCredentials: true,
    });
  }

  /** Coordinator/Admin direct delete — cascades to the assessment's marks
   *  server-side and recomputes affected grades. 204, no body. */
  deleteAssessment(assessmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.marksUrl}/assessments/${assessmentId}`, { withCredentials: true });
  }

  // --- Marks ---
  getMarks(assessmentId: string): Observable<MarkFull[]> {
    return this.http.get<MarkFull[]>(`${this.marksUrl}/assessments/${assessmentId}/marks`, {
      withCredentials: true,
    });
  }

  upsertMarks(assessmentId: string, entries: MarkUpsertPayload[]): Observable<MarkFull[]> {
    return this.http.put<MarkFull[]>(`${this.marksUrl}/assessments/${assessmentId}/marks`, entries, {
      withCredentials: true,
    });
  }

  /** Coordinator/Admin direct delete of one student's mark — same
   *  "bypass the Teacher lock" rationale as the assessment endpoints. */
  deleteMark(markId: string): Observable<void> {
    return this.http.delete<void>(`${this.marksUrl}/marks/${markId}`, { withCredentials: true });
  }

  // --- Mark Edit Requests (Sub-Sprint 5) ---
  requestMarkEdit(markId: string, payload: CreateMarkEditRequestPayload): Observable<MarkEditRequestFull> {
    return this.http.post<MarkEditRequestFull>(`${this.marksUrl}/marks/${markId}/edit-requests`, payload, {
      withCredentials: true,
    });
  }

  /** The signed-in Teacher's own edit requests, newest first — powers the
   *  Sub-Sprint 5.2 status-tracking list (Pending/Approved/Rejected). */
  getMyMarkEditRequests(): Observable<MarkEditRequestFull[]> {
    return this.http.get<MarkEditRequestFull[]>(`${this.marksUrl}/marks/edit-requests/mine`, {
      withCredentials: true,
    });
  }

  /** Coordinator/Admin queue of pending mark-edit requests submitted by
   *  Teachers (GET /api/academics/marks/edit-requests/pending). Same
   *  enriched shape as getMyMarkEditRequests(), just server-filtered to
   *  every teacher's pending requests instead of just the caller's own. */
  getPendingMarkEditRequests(): Observable<MarkEditRequestFull[]> {
    return this.http.get<MarkEditRequestFull[]>(`${this.marksUrl}/marks/edit-requests/pending`, {
      withCredentials: true,
    });
  }

  /** Approve/reject a mark edit request, with an optional review note
   *  (schema_update_3.sql). Approving writes the requested change straight
   *  to the Mark row server-side and notifies the requesting Teacher either
   *  way — nothing further to do here after the call succeeds. */
  reviewMarkEditRequest(requestId: string, payload: ReviewMarkEditRequestPayload): Observable<MarkEditRequestFull> {
    return this.http.patch<MarkEditRequestFull>(
      `${this.marksUrl}/marks/edit-requests/${requestId}`,
      payload,
      { withCredentials: true },
    );
  }

  // --- Grades (Coordinator view — purely computed rollup, see GradeFull) ---
  getGrades(subjectId?: string, batchId?: string, studentId?: string): Observable<GradeFull[]> {
    const params: Record<string, string> = {};
    if (subjectId) params['subject_id'] = subjectId;
    if (batchId) params['batch_id'] = batchId;
    if (studentId) params['student_id'] = studentId;
    return this.http.get<GradeFull[]>(`${this.marksUrl}/grades`, { params, withCredentials: true });
  }

  /**
   * Mark Override refactor (schema_update_18): Coordinator/Admin direct
   * correction of ONE student's score on ONE assessment — PATCH
   * /api/academics/marks/{mark_id}/mark-override. Replaces the removed
   * overrideGrade()/PATCH .../grades/{id}/override: a subject-level letter
   * grade is never set directly, the backend recomputes it from marks
   * after this call. `mark_id` must already exist (see MarkFull.id from
   * getMarks()) — there is no "override a mark that was never entered"
   * path here; a missing mark is entered via upsertMarks() first.
   */
  markOverride(markId: string, payload: MarkOverridePayload): Observable<MarkFull> {
    return this.http.patch<MarkFull>(`${this.marksUrl}/marks/${markId}/mark-override`, payload, {
      withCredentials: true,
    });
  }

  /** Scoped to one subject+batch — see the endpoint's own docstring for why
   *  this isn't just the general Admin-only /api/audit-logs. Renamed from
   *  getGradeAuditHistory (schema_update_18): now tracks Mark corrections
   *  (entity_type "marks"), not Grade corrections. */
  getMarkAuditHistory(subjectId: string, batchId: string): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogEntry[]>(`${this.marksUrl}/marks/audit-history`, {
      params: { subject_id: subjectId, batch_id: batchId },
      withCredentials: true,
    });
  }

  // --- Subject Requests (Coordinator/Admin review queue) ---
  /** Defaults to just pending ("requested") — pass '' to see the full history including approved/rejected. */
  getSubjectRequestQueue(statusFilter: string = 'requested'): Observable<SubjectRequestReviewRow[]> {
    const params: Record<string, string> = statusFilter ? { status_filter: statusFilter } : {};
    return this.http.get<SubjectRequestReviewRow[]>(`${this.academicUrl}/subject-requests/review-queue`, {
      params,
      withCredentials: true,
    });
  }

  reviewSubjectRequest(requestId: string, payload: ReviewSubjectRequestPayload): Observable<SubjectRequestReviewRow> {
    return this.http.patch<SubjectRequestReviewRow>(
      `${this.academicUrl}/subject-requests/${requestId}`,
      payload,
      { withCredentials: true },
    );
  }
}