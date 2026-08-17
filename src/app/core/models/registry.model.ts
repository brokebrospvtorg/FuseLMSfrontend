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
  parent_id?: string | null;
  relationship_label?: string | null;
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
