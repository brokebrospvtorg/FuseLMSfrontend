import { UserRole, UserStatus } from './enums';

/** Mirrors backend UserOut (see app/schemas/user.py). */
export interface RegistryUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
}

/** The 4 roles creatable/assignable through the API — Admin is DB-only, never here. */
export type AssignableRole = 'coordinator' | 'teacher' | 'student' | 'parent';

/** Mirrors backend UserCreate (see app/schemas/user.py). */
export interface CreateUserRequest {
  full_name: string;
  email: string;
  role: AssignableRole;
  roll_number?: string | null;
  admission_date?: string | null;
  designation?: string | null;
  hire_date?: string | null;
  parent_id?: string | null;
  relationship_label?: string | null;
}

/** Mirrors backend UserUpdate — every field optional, send only what's changing. */
export interface UpdateUserRequest {
  full_name?: string;
  status?: 'active' | 'suspended';
  role?: AssignableRole;
}
