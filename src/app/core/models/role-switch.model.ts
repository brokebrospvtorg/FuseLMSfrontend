
/**
 * The two portal "shells" a dual-role account can stand in. Deliberately
 * NOT reusing UserRole (core/models/enums.ts) here — UserRole is the
 * account's actual DB-backed role (single value, server-authoritative,
 * checked by every backend require_roles(...) call). ActivePortalRole is
 * purely a frontend "which set of nav items / route tree am I looking
 * at" concept for the one case where those two things can legitimately
 * differ: a Coordinator account that also has TeacherSubjectAssignment
 * rows. For every other account (Teacher, Student, Parent, Admin) the
 * active portal role and the account role are always the same thing and
 * this type is never consulted.
 */
export enum ActivePortalRole {
    Coordinator = 'coordinator',
    Teacher = 'teacher',
  }
  
  /**
   * Minimal shape this feature needs out of a TeacherSubjectAssignment row
   * (see TeacherAssignment in academics-staff.model.ts for the full DTO).
   * Kept separate/narrow here so RoleSwitchService doesn't need to import
   * the full academics model just to answer "do I have at least one".
   */
  export interface TeacherAssignmentSummary {
    subject_id: string;
    batch_id: string;
  }