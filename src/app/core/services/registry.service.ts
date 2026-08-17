import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import {
  RegistryUser, RegistryUserDetail, CreateUserRequest, UpdateUserRequest,
  TeacherAssignmentRegistryEntry, ParentChildRegistryEntry,
  ParentStudentLink, CreateParentLinkRequest, StudentEnrollmentRegistryEntry,
} from '../models/registry.model';

/**
 * 5.2 gave us the read side. 5.3 added create/edit-role/suspend. This
 * sprint (registry-fields) adds getUser() for the detail fetch the Edit
 * Details dialog needs — the list endpoint only returns base UserOut
 * fields, not the profile-table extras. Also adds the two read-only
 * relational lookups (Teacher's classes/subjects taught, Parent's linked
 * children) that the profile tables themselves can't answer, since that
 * data lives in teacher_subject_assignments / parent_student_links instead.
 */
@Injectable({ providedIn: 'root' })
export class RegistryService {
  private readonly apiBaseUrl = APP_CONFIG.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getUsers(role?: string): Observable<RegistryUser[]> {
    const url = role ? `${this.apiBaseUrl}/users?role=${role}` : `${this.apiBaseUrl}/users`;
    return this.http.get<RegistryUser[]>(url, { withCredentials: true });
  }

  getUser(userId: string): Observable<RegistryUserDetail> {
    return this.http.get<RegistryUserDetail>(`${this.apiBaseUrl}/users/${userId}`, { withCredentials: true });
  }

  createUser(payload: CreateUserRequest): Observable<RegistryUser> {
    return this.http.post<RegistryUser>(`${this.apiBaseUrl}/users`, payload, { withCredentials: true });
  }

  updateUser(userId: string, payload: UpdateUserRequest): Observable<RegistryUser> {
    return this.http.patch<RegistryUser>(`${this.apiBaseUrl}/users/${userId}`, payload, { withCredentials: true });
  }

  getTeacherAssignments(teacherId: string): Observable<TeacherAssignmentRegistryEntry[]> {
    return this.http.get<TeacherAssignmentRegistryEntry[]>(
      `${this.apiBaseUrl}/academic/teacher-assignments/registry?teacher_id=${teacherId}`,
      { withCredentials: true },
    );
  }

  /** Student-side counterpart to getTeacherAssignments — "level, registered
   *  courses" for the Registry's Student Edit Details view. */
  getStudentEnrollments(studentId: string): Observable<StudentEnrollmentRegistryEntry> {
    return this.http.get<StudentEnrollmentRegistryEntry>(
      `${this.apiBaseUrl}/academic/student-enrollments/registry?student_id=${studentId}`,
      { withCredentials: true },
    );
  }

  getParentChildren(parentId: string): Observable<ParentChildRegistryEntry[]> {
    return this.http.get<ParentChildRegistryEntry[]>(
      `${this.apiBaseUrl}/users/${parentId}/children`,
      { withCredentials: true },
    );
  }

  /** Read-only view for a Student's Edit Details dialog — "Parent id and
   *  name" from spec module 2. */
  getParentsForStudent(studentId: string): Observable<ParentStudentLink[]> {
    return this.http.get<ParentStudentLink[]>(
      `${this.apiBaseUrl}/users/${studentId}/parents`,
      { withCredentials: true },
    );
  }

  /** Standalone linking — for connecting an already-existing Parent to an
   *  already-existing Student, independent of the Add User creation flow. */
  createParentLink(payload: CreateParentLinkRequest): Observable<ParentStudentLink> {
    return this.http.post<ParentStudentLink>(
      `${this.apiBaseUrl}/users/parent-links`, payload, { withCredentials: true },
    );
  }

  /** Admin-only on the backend (require_roles("admin")) — the component
   *  hides this action for Coordinator, but the real enforcement is server-side. */
  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/users/${userId}`, { withCredentials: true });
  }
}
