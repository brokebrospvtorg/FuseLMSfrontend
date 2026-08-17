import { ComplaintStatus, NotificationChannel } from './enums';

/** Mirrors app/models/complaints.py */

export interface Complaint {
  id: string;
  submitted_by: string;
  submitted_by_name: string;
  submitted_by_role: string;
  // Optional as of Sub-Sprint 6: a Teacher's general feedback/complaint
  // (Sub-Sprint 6.2) isn't about a specific student, unlike a Student's own
  // complaint or a Parent's on their child's behalf, which both still set it.
  student_id: string | null;
  student_name: string | null;
  subject_of_complaint: string | null;
  description: string;
  status: ComplaintStatus;
  resolved_at: string | null;
  // Coordinator/Admin's reply text when progressing or closing the
  // complaint — schema_update.sql #8, wired up in Sub-Sprint 6.2.
  resolution_message: string | null;
  created_at: string;
}

export interface CreateComplaint {
  student_id?: string | null;
  subject_of_complaint: string | null;
  description: string;
}

export interface ResolveComplaintPayload {
  status: ComplaintStatus;
  resolution_message?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  channel: NotificationChannel;
  read_at: string | null;
  created_at: string;
}
