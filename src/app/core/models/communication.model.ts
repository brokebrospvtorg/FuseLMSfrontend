import { ComplaintStatus, NotificationChannel } from './enums';

/** Mirrors app/models/complaints.py */

export interface Complaint {
  id: string;
  student_id: string;
  subject_of_complaint: string | null;
  description: string;
  status: ComplaintStatus;
  resolved_at: string | null;
  created_at: string;
}

export interface CreateComplaint {
  student_id: string;
  subject_of_complaint: string | null;
  description: string;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  channel: NotificationChannel;
  read_at: string | null;
  created_at: string;
}
