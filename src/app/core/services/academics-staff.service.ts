import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { Subject, Batch, Level, SubjectRequestReviewRow, ReviewSubjectRequestPayload } from '../models/academic.model';
import {
  AssessmentFull, CreateAssessmentRequest, RosterEntry, MarkUpsertPayload, MarkFull,
  GradeFull, GradeOverridePayload, TeacherAssignment, AuditLogEntry,
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

  constructor(private http: HttpClient) {}

  // --- Pickers (level / subject / batch / my assignments) ---
  getLevels(): Observable<Level[]> {
    return this.http.get<Level[]>(`${this.academicUrl}/levels`, { withCredentials: true });
  }

  getSubjects(levelId?: string): Observable<Subject[]> {
    const params: Record<string, string> = levelId ? { level_id: levelId } : {};
    return this.http.get<Subject[]>(`${this.academicUrl}/subjects`, { params, withCredentials: true });
  }

  getBatches(): Observable<Batch[]> {
    return this.http.get<Batch[]>(`${this.academicUrl}/batches`, { withCredentials: true });
  }

  /** Server-side filters to "my own" when the caller is a Teacher. */
  getMyTeacherAssignments(): Observable<TeacherAssignment[]> {
    return this.http.get<TeacherAssignment[]>(`${this.academicUrl}/teacher-assignments`, { withCredentials: true });
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

  // --- Grades (Coordinator view + override) ---
  getGrades(subjectId?: string, batchId?: string, studentId?: string): Observable<GradeFull[]> {
    const params: Record<string, string> = {};
    if (subjectId) params['subject_id'] = subjectId;
    if (batchId) params['batch_id'] = batchId;
    if (studentId) params['student_id'] = studentId;
    return this.http.get<GradeFull[]>(`${this.marksUrl}/grades`, { params, withCredentials: true });
  }

  overrideGrade(gradeId: string, payload: GradeOverridePayload): Observable<GradeFull> {
    return this.http.patch<GradeFull>(`${this.marksUrl}/grades/${gradeId}/override`, payload, {
      withCredentials: true,
    });
  }

  /** Scoped to one subject+batch — see the endpoint's own docstring for why
   *  this isn't just the general Admin-only /api/audit-logs. */
  getGradeAuditHistory(subjectId: string, batchId: string): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogEntry[]>(`${this.marksUrl}/grades/audit-history`, {
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
