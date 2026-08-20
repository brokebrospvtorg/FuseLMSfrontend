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
  Closed = 'closed',
}

export enum NotificationChannel {
  Email = 'email',
  InApp = 'in_app',
  Both = 'both',
}

/**
 * Subject & Class Management (Admin/Coordinator only). Mirrors the
 * `class_level` Postgres enum (schema_update_10_class_subjects.sql) and
 * app/schemas/subject.py's ClassLevelEnum — strictly these 4 values.
 */
export enum ClassLevel {
  OLevel = 'O Level',
  ASLevel = 'AS Level',
  A2Level = 'A2 Level',
  ALevelCombined = 'A Level (Combined)',
}

/**
 * Exam Board — schema_update_11. Mirrors the `board` Postgres enum and
 * app/schemas/common.py's BoardEnum — keep all three in sync by hand,
 * same convention as every other enum here. Used by Student registration/
 * edit (single, required), Teacher registration/edit (one or more), and
 * Batch creation/edit (single).
 */
export enum Board {
  BritishCouncil = 'British Council',
  Edexcel = 'Edexcel',
  LRN = 'LRN',
  // schema_update_16: catalog Subjects only (POST /api/academic/subjects)
  // — deliberately not added to Student/Teacher/Batch board dropdowns
  // (see BOARD_OPTIONS in board-options.util.ts, which is unchanged).
  All = 'All',
}
