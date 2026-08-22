import { UserRole } from './enums';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CurrentUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  // Password Management: true right after an Admin/Coordinator sets a
  // temporary password for this account (creation with initial_password,
  // or a Reset Password action) — cleared by a successful self-service
  // Change Password. Drives the "you're on a temporary password" nudge in
  // the portal header; nothing forces the change, it's informational.
  must_change_password: boolean;
}

/** POST /api/auth/change-password. Requires the CURRENT password — this is
 *  what distinguishes it from the Admin/Coordinator reset-password path
 *  (which doesn't need it) and from the forgot-password email-token flow
 *  (proving control of the inbox is the trust anchor there instead). */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

/** POST /api/auth/request-password-reset-approval — the logged-out
 *  'Request Password Reset from Admin' button. identifier is free text:
 *  email, Student roll number, or Teacher employee code. */
export interface PasswordResetApprovalRequest {
  identifier: string;
}

/** Admin Operations > Password Requests queue row. Mirrors
 *  PasswordResetRequestOut. */
export interface PasswordResetRequestRow {
  id: string;
  user_id: string;
  user_name: string | null;
  role: string | null;
  roll_or_employee_id: string | null;
  identifier_submitted: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ReviewPasswordResetRequestPayload {
  status: 'approved' | 'rejected';
  review_note: string | null;
}
