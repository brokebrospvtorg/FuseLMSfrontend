import { UserRole, UserStatus } from './enums';
import { StudentProfile, TeacherProfile, ParentProfile } from './user.model';

/** Mirrors backend UserOut (see app/schemas/user.py). */
export interface RegistryUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone_number: string | null;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
  // Password Management: true right after an Admin/Coordinator sets a
  // temporary password (account creation with initial_password, or a
  // Reset Password action) — cleared to false only by the user's own
  // self-service Change Password. Purely informational here (e.g. an
  // "Temp password" badge); nothing in the Registry enforces it.
  must_change_password: boolean;
}

/** Mirrors backend UserDetailOut — RegistryUser + whichever profile applies. */
export interface RegistryUserDetail extends RegistryUser {
  student_profile: StudentProfile | null;
  teacher_profile: TeacherProfile | null;
  parent_profile: ParentProfile | null;
}

/** The 4 roles creatable/assignable through the API — Admin is DB-only, never here. */
export type AssignableRole = 'coordinator' | 'teacher' | 'student' | 'parent';

/** Mirrors backend UserCreate (see app/schemas/user.py). */
export interface CreateUserRequest {
  full_name: string;
  email: string;
  role: AssignableRole;
  phone_number?: string | null;
  // Admin Student Creation: no roll_number field here at all (compare
  // UpdateUserRequest below, which still has one) — Roll Number is always
  // server-generated (INK-{year}-XXXX) on create, never client-supplied,
  // same convention as teacher_code.
  admission_date?: string | null;
  father_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  religion?: string | null;
  nationality?: string | null;
  cnic?: string | null;
  // Student-only: the student's own exam-board registration id (unrelated
  // to the Parent Reg ID auto-assigned when role === 'parent' — that one
  // has no field here at all, same reasoning as roll_number above).
  registration_id?: string | null;
  designation?: string | null;
  hire_date?: string | null;
  // Admin Teacher Creation: no teacher_code field here at all (compare
  // UpdateUserRequest below, which still has one) — Teacher Code is
  // always server-generated (INK-T-XXXX) on create, never client-supplied.
  // Multi-Level Teacher Assignment: the academic level(s) — e.g. O
  // Level, AS Level, A Level Composite — this teacher is qualified to
  // teach. Teacher-only, REQUIRED (at least one) when role === 'teacher'.
  // Sent as an array of level UUIDs, not a single level_id.
  level_ids?: string[] | null;
  // Parent Link Flow (Student creation only): explicit choice between
  // linking an existing Parent now ('existing', parent_id required) or
  // deferring it ('later' — Link Parent from the Registry row action
  // covers it afterwards). Omitting this is equivalent to 'later'.
  parent_link_mode?: 'existing' | 'later' | null;
  parent_id?: string | null;
  relationship_label?: string | null;
  // Cascading Scope (Student creation only): optional initial Batch ->
  // Level -> Subject enrollment, same three-stage shape as the existing
  // Add Teacher initial-assignment cascade. Leaving batch_id unset creates
  // the Student with no initial enrollment; Admin User Management (Edit
  // Details) remains available afterwards either way. subject_ids requires
  // both batch_id and level_id to be set alongside it.
  batch_id?: string | null;
  level_id?: string | null;
  subject_ids?: string[] | null;
  // Password Management: Admin/Coordinator may set the account's initial
  // password directly instead of the default email-activation-token flow.
  // Omit/blank to keep today's behaviour exactly as-is (status='pending',
  // activation email). When provided (min 8 chars, enforced both here and
  // by UserCreate server-side), the account is created 'active' with this
  // password and must_change_password=True, so the person is prompted to
  // pick their own on first login. Ignored entirely for role === 'teacher'
  // (DEFAULT_TEACHER_INITIAL_PASSWORD) and role === 'student'
  // (DEFAULT_STUDENT_INITIAL_PASSWORD) — those always win server-side.
  initial_password?: string | null;
}

/** Mirrors backend UserUpdate — every field optional, send only what's changing. */
export interface UpdateUserRequest {
  full_name?: string;
  status?: 'active' | 'suspended';
  role?: AssignableRole;
  phone_number?: string | null;
  roll_number?: string | null;
  admission_date?: string | null;
  father_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  religion?: string | null;
  nationality?: string | null;
  cnic?: string | null;
  registration_id?: string | null;
  designation?: string | null;
  hire_date?: string | null;
  teacher_code?: string | null;
  /** Student academic level + subject assignment (Admin User Management).
   *  Both optional/role-agnostic here, same convention as the rest of this
   *  interface — only applied server-side when the target user is a
   *  student. `subject_ids` is a full replacement of the student's active
   *  subject set for the current batch (send the complete desired list) —
   *  an empty array is a valid, explicit "unassign every subject", distinct
   *  from omitting the field (which leaves subjects untouched). */
  level_id?: string | null;
  /** Batch -> Level -> Subject cascade: which Batch subject_ids/level_id
   *  are being resolved against — now explicit and caller-supplied rather
   *  than the backend silently resolving "whichever Batch is flagged
   *  is_current" on its own. Student-only, same role-agnostic-at-the-
   *  schema-level convention as level_id/subject_ids above. Omit to leave
   *  the student's existing batch-scoped enrollments untouched (e.g. a
   *  PATCH that only changes phone_number). */
  batch_id?: string | null;
  subject_ids?: string[];
}

/** Mirrors backend TeacherAssignmentRegistryOut (GET /api/academic/teacher-assignments/registry).
 *  Read-only — for displaying "classes taught, subjects taught" in the
 *  Registry's Edit Details view, not for editing. */
export interface TeacherAssignmentRegistryEntry {
  subject_id: string;
  subject_name: string;
  batch_id: string;
  batch_name: string;
}

/** Mirrors backend StudentEnrollmentRegistryOut (GET /api/academic/student-enrollments/registry).
 *  Read-only — for displaying "level, registered courses" in the Registry's
 *  Student Edit Details view, student-side counterpart to
 *  TeacherAssignmentRegistryEntry above. */
export interface StudentEnrollmentRegistryEntry {
  current_level_id: string | null;
  current_level_name: string | null;
  subjects: StudentEnrollmentRegistrySubject[];
}

export interface StudentEnrollmentRegistrySubject {
  subject_id: string;
  subject_name: string;
  batch_id: string;
  batch_name: string;
  status: string;
  // Cross-Level Subject Enrollment: the enrollment's own level — may differ
  // from StudentEnrollmentRegistryEntry.current_level_id above when this
  // subject was enrolled cross-level (e.g. an A-Level subject on an
  // otherwise O-Level student).
  level_id: string | null;
  level_name: string | null;
}

/** Mirrors backend ParentChildRegistryOut (GET /api/users/{parent_id}/children).
 *  Read-only — for displaying a Parent's linked children in the Registry. */
export interface ParentChildRegistryEntry {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  relationship: string | null;
}

/** Mirrors backend ParentStudentLinkOut (GET /api/users/{student_id}/parents,
 *  POST /api/users/parent-links). */
export interface ParentStudentLink {
  id: string;
  parent_id: string;
  student_id: string;
  relationship_label: string | null;
  created_at: string;
}

export interface CreateParentLinkRequest {
  parent_id: string;
  student_id: string;
  relationship_label?: string | null;
}

/** Mirrors backend AdminResetPasswordRequest (POST
 *  /api/users/{user_id}/reset-password) — Admin/Coordinator sets a new
 *  temporary password for someone else. No current_password field here,
 *  unlike the self-service ChangePasswordRequest: the caller's own
 *  admin/coordinator session is the trust anchor, not knowledge of the
 *  target's old password. */
export interface AdminResetPasswordRequest {
  new_password: string;
}
