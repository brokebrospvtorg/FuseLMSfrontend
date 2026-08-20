import { UserRole, UserStatus, Board } from './enums';

/** Mirrors app/models/identity.py — User table */
export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phone_number: string | null;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
  must_change_password: boolean;
}

export interface StudentProfile {
  user_id: string;
  roll_number: string | null;
  admission_date: string | null;
  father_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  religion: string | null;
  nationality: string | null;
  cnic: string | null;
  registration_id: string | null;
  // schema_update_11: required exam board this student is registered
  // under (British Council / Edexcel / LRN).
  board: Board;
}

export interface TeacherProfile {
  user_id: string;
  designation: string | null;
  hire_date: string | null;
  gender: string | null;
  cnic: string | null;
  teacher_code: string | null;
  // schema_update_11: the board(s) this teacher is qualified to teach —
  // at least one. Populated by the router from TeacherBoard rows.
  boards: Board[];
}

export interface ParentProfile {
  user_id: string;
  cnic: string | null;
  registration_id: string | null;
  registration_date: string | null;
}

export interface MyProfile {
  user: User;
  student_profile: StudentProfile | null;
  teacher_profile: TeacherProfile | null;
  parent_profile: ParentProfile | null;
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
