import { UserRole, UserStatus } from './enums';

/** Mirrors app/models/identity.py — User table */
export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface StudentProfile {
  user_id: string;
  roll_number: string | null;
  admission_date: string | null;
}

export interface TeacherProfile {
  user_id: string;
  designation: string | null;
  hire_date: string | null;
}

export interface MyProfile {
  user: User;
  student_profile: StudentProfile | null;
  class_name: string | null;
}

export interface ParentStudentLink {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string | null;
}

export interface CorrectionRequest {
  id: string;
  student_id: string;
  requested_changes: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
