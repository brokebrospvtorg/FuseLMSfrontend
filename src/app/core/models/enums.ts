/**
 * Mirrors app/models/enums.py on the backend. Keep these in sync
 * manually — nothing generates one from the other.
 */

export enum UserRole {
  Admin = 'admin',
  Coordinator = 'coordinator',
  Teacher = 'teacher',
  Student = 'student',
  Parent = 'parent',
}

export enum UserStatus {
  Pending = 'pending',
  Active = 'active',
  Suspended = 'suspended',
}

export enum BatchSession {
  MayJune = 'may_june',
  OctNov = 'oct_nov',
}

export enum LevelEnrollmentStatus {
  Active = 'active',
  Completed = 'completed',
  NotPromoted = 'not_promoted',
  Withdrawn = 'withdrawn',
}

export enum SubjectRequestStatus {
  Requested = 'requested',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum EnrollmentStatus {
  Active = 'active',
  Dropped = 'dropped',
}

export enum DayOfWeek {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
  Sunday = 'sunday',
}

export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  Late = 'late',
  Excused = 'excused',
}

export enum AssessmentStatus {
  Draft = 'draft',
  Published = 'published',
}

export enum FeeProofStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum MaterialType {
  Notes = 'notes',
  Worksheet = 'worksheet',
  PastPaper = 'past_paper',
  Other = 'other',
}

export enum ComplaintStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Resolved = 'resolved',
}

export enum NotificationChannel {
  Email = 'email',
  InApp = 'in_app',
  Both = 'both',
}
