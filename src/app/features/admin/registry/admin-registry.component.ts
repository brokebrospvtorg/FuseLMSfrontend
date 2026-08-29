import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { RegistryService } from '../../../core/services/registry.service';
import { AuthService } from '../../../core/services/auth.service';
import { AcademicService } from '../../../core/services/academic.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import {
  RegistryUser, RegistryUserDetail, AssignableRole,
  TeacherAssignmentRegistryEntry, ParentChildRegistryEntry, ParentStudentLink,
  StudentEnrollmentRegistryEntry,
} from '../../../core/models/registry.model';
import { Batch, Level, Subject, BatchSubject } from '../../../core/models/academic.model';
import { evaluatePasswordStrength } from '../../../shared/utils/password-strength.util';

const ROLE_FILTER_OPTIONS = [
  { label: 'All roles', value: null },
  { label: 'Admin', value: 'admin' },
  { label: 'Coordinator', value: 'coordinator' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
  { label: 'Parent', value: 'parent' },
];

// The 4 roles the API will ever accept for creation or reassignment —
// Admin is deliberately excluded (root-only, DB-precreated). Both dropdowns
// below (Add User, Edit Role) share this exact list so neither can ever
// offer an option the backend would reject.
const ASSIGNABLE_ROLE_OPTIONS: { label: string; value: AssignableRole }[] = [
  { label: 'Coordinator', value: 'coordinator' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
  { label: 'Parent', value: 'parent' },
];

// Hierarchy rule: Admin assigns Coordinator; Coordinator assigns
// Teacher/Student/Parent; Admin can do all of it. A logged-in Coordinator
// never even sees "Coordinator" as a pickable option — matches the
// backend's 403 on that combination, so the UI doesn't offer something
// that would just fail.
const COORDINATOR_ASSIGNABLE_ROLE_OPTIONS = ASSIGNABLE_ROLE_OPTIONS.filter((o) => o.value !== 'coordinator');

// Strict format validators (client-side mirror of the backend's own
// regex checks) — Phone Number must be a Pakistani mobile number in
// either +92 or 0-prefixed form (e.g. +923001234567 / 03001234567);
// CNIC must be the standard 13-digit dashed format (e.g. 12345-1234567-1).
// Both fields stay optional (blank is fine — see the "|| null" mapping
// in submitAddUser/submitEditDetails below); the pattern only applies
// once something has actually been typed in.
const PHONE_NUMBER_PATTERN = /^(\+92|0)3\d{9}$/;
const CNIC_PATTERN = /^\d{5}-\d{7}-\d{1}$/;

// Fixed option sets for the Gender / Religion / Nationality dropdowns —
// replaces the old free-text inputs so these fields can only ever hold
// one of the exact values the backend expects.
const GENDER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];
const RELIGION_OPTIONS: { label: string; value: string }[] = [
  { label: 'Islam', value: 'Islam' },
  { label: 'Christianity', value: 'Christianity' },
  { label: 'Hinduism', value: 'Hinduism' },
  { label: 'Sikhism', value: 'Sikhism' },
  { label: 'Other', value: 'Other' },
];
const NATIONALITY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Pakistani', value: 'Pakistani' },
  { label: 'Other', value: 'Other' },
];

@Component({
  selector: 'app-admin-registry',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, MultiSelectModule, ButtonModule,
    DialogModule, InputTextModule, DatePickerModule, TagModule, MessageModule, ProgressSpinnerModule,
    ToggleSwitchModule,
  ],
  templateUrl: './admin-registry.component.html',
  styleUrl: './admin-registry.component.scss',
})
export class AdminRegistryComponent implements OnInit {
  // Admin Student Creation: purely a display value for the Add User
  // dialog's "Auto-generated (format INK-{year}-XXXX)" hint — matches the
  // server's own current-year-at-creation-time convention (_next_roll_number).
  currentYear = new Date().getFullYear();

  roleFilterOptions = ROLE_FILTER_OPTIONS;
  // Computed (not a static field) so it can depend on isAdmin() below —
  // ordering in the class body doesn't matter since computed() callbacks
  // are evaluated lazily, only when the template actually reads them.
  assignableRoleOptions = computed(() =>
    this.isAdmin() ? ASSIGNABLE_ROLE_OPTIONS : COORDINATOR_ASSIGNABLE_ROLE_OPTIONS,
  );

  users = signal<RegistryUser[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  roleFilter = signal<string | null>(null);
  searchTerm = signal('');

  filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.users();
    return this.users().filter(
      (u) => u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  });

  // --- Add User dialog ---
  addDialogOpen = signal(false);
  addSubmitting = signal(false);
  newFullName = signal('');
  newEmail = signal('');
  newRole = signal<AssignableRole | null>(null);
  newPhoneNumber = signal('');
  // Role-conditional extras
  // Admin Student Creation, point 1: Roll Number is no longer entered here
  // at all — it's server-generated (INK-{year}-XXXX) the moment the
  // account is created. No signal for it any more; the Add User dialog
  // just shows an informational note (see template), same treatment as
  // Teacher Code.
  newAdmissionDate = signal<Date | null>(null);
  newFatherName = signal('');
  newDateOfBirth = signal<Date | null>(null);
  newGender = signal('');
  newReligion = signal('');
  newNationality = signal('');
  newCnic = signal('');
  // Registration ID is now only ever entered for a Parent — the Student
  // form's Registration ID control has been removed entirely (it's
  // system-generated at enrollment, same as Roll Number).
  newRegistrationId = signal('');
  newHireDate = signal<Date | null>(null);
  // Admin Teacher Creation, point 1: Teacher Code is no longer entered
  // here at all — it's server-generated (INK-T-XXXX) the moment the
  // account is created. No signal for it anymore; the Add User dialog
  // just shows an informational note (see template) instead of an input.
  genderOptions = GENDER_OPTIONS;
  religionOptions = RELIGION_OPTIONS;
  nationalityOptions = NATIONALITY_OPTIONS;
  // Password Management: Admin/Coordinator can optionally set the account's
  // initial password directly instead of the default email-activation-token
  // path. Off by default so unmodified behaviour (pending + activation
  // email) stays the default for every existing Add User submission.
  // Admin Teacher Creation, point 3: irrelevant for role === 'teacher' —
  // that role always gets the fixed default password server-side
  // (DEFAULT_TEACHER_INITIAL_PASSWORD) no matter what's in these signals,
  // so the template hides this whole toggle+fields block for Teacher and
  // shows a fixed-credentials hint instead.
  newSetInitialPassword = signal(false);
  newInitialPassword = signal('');
  newInitialPasswordConfirm = signal('');

  // --- Add Teacher: initial Batch/Level/Subject assignment (optional) ---
  // Cascading dropdowns per Admin Teacher Creation point 2. Batch is a
  // free pick here (unlike the Edit Details student subject-picker further
  // down, which is pinned to currentBatchId) since a new Teacher isn't
  // tied to "the" current batch the way a Student's active enrollment is.
  // Level is the global 4-level catalog (academicLevels, loaded once in
  // ngOnInit); Subject options are whatever's actually offered+active for
  // the chosen Batch, filtered down to the chosen Level(s) — same
  // "offered-subjects, never the raw catalog" rule as everywhere else in
  // this component (see levelSubjects' own docstring above). Entirely
  // optional: leaving Batch unset just creates the Teacher account with no
  // initial subject assignment, exactly like today, and Assign Teacher
  // remains available afterwards from the Admin Batches screen either way.
  allBatches = signal<Batch[]>([]);
  newTeacherBatchOptions = computed(() =>
    this.allBatches().map((b) => ({ label: b.name, value: b.id })),
  );
  newTeacherBatchId = signal<string | null>(null);
  // Multi-Level Teacher Assignment: a Teacher can now be qualified to
  // teach more than one academic level at once (e.g. O Level, AS Level,
  // and A Level Composite together) — this is a required, teacher-wide
  // qualification, independent of whether an initial
  // Batch/Subject assignment is made. Sent to the backend as `level_ids`
  // (an array of level UUIDs) rather than the old single `level_id`.
  newTeacherLevelIds = signal<string[]>([]);
  newTeacherOfferedSubjects = signal<BatchSubject[]>([]);
  newTeacherOfferedSubjectsLoading = signal(false);
  newTeacherSubjectIds = signal<string[]>([]);
  // Subject options now pool every offered subject across every one of
  // the teacher's selected levels, not just a single level.
  newTeacherSubjectOptions = computed(() =>
    this.newTeacherOfferedSubjects()
      .filter((s) => this.newTeacherLevelIds().includes(s.level_id))
      .map((s) => ({ label: s.subject_name, value: s.subject_id })),
  );

  // --- Add Student: Cascading Scope (Batch -> Level -> Subject), optional
  // initial enrollment. Same three-stage shape as the Add Teacher cascade
  // just above, with its own dedicated Batch dropdown so a Student's
  // initial batch pick is independent of whatever's selected in the
  // Teacher form. UNLIKE the Add Teacher cascade, this one is sourced
  // from activeBatches (GET /batches?active_only=true), not allBatches —
  // a new Student shouldn't be enrollable into a batch that's already
  // been marked inactive/completed. See loadActiveBatches() below. ---
  activeBatches = signal<Batch[]>([]);
  newStudentBatchOptions = computed(() =>
    this.activeBatches().map((b) => ({ label: b.name, value: b.id })),
  );
  newStudentBatchId = signal<string | null>(null);
  newStudentLevelId = signal<string | null>(null);
  newStudentOfferedSubjects = signal<BatchSubject[]>([]);
  newStudentOfferedSubjectsLoading = signal(false);
  newStudentSubjectIds = signal<string[]>([]);
  newStudentSubjectOptions = computed(() =>
    this.newStudentOfferedSubjects()
      .filter((s) => s.level_id === this.newStudentLevelId())
      .map((s) => ({ label: s.subject_name, value: s.subject_id })),
  );

  // --- Add Student: Parent Link Flow — "Link Existing Parent" or "Link
  // Later". Defaults to 'later' so an Admin who doesn't touch this control
  // gets today's behaviour (no link created at account-creation time). ---
  newParentLinkMode = signal<'existing' | 'later'>('later');
  parentLinkModeOptions: { label: string; value: 'existing' | 'later' }[] = [
    { label: 'Link Existing Parent', value: 'existing' },
    { label: 'Link Later', value: 'later' },
  ];

  // --- Edit Role dialog ---
  editRoleDialogOpen = signal(false);
  editingUser = signal<RegistryUser | null>(null);
  editRoleValue = signal<AssignableRole | null>(null);
  editRoleSubmitting = signal(false);

  // --- Edit Details dialog (registry fields — Coordinator/Admin, per spec module 2) ---
  editDetailsDialogOpen = signal(false);
  editDetailsLoading = signal(false);
  editDetailsSubmitting = signal(false);
  editDetailsUser = signal<RegistryUserDetail | null>(null);

  // Read-only relational data — "classes taught, subjects taught" for a
  // Teacher, "child ID and name" for a Parent (spec module 2). Not part of
  // the editable profile-table fields; fetched separately since they live
  // in teacher_subject_assignments / parent_student_links instead.
  teacherAssignments = signal<TeacherAssignmentRegistryEntry[]>([]);
  teacherAssignmentsLoading = signal(false);
  parentChildren = signal<ParentChildRegistryEntry[]>([]);
  parentChildrenLoading = signal(false);

  // Student's linked parent(s), read-only (spec: "Parent id and name").
  studentParents = signal<ParentStudentLink[]>([]);
  studentParentsLoading = signal(false);

  // Student's current level + registered courses. The summary line stays
  // read-only (spec module 2: "level, registered courses"), fetched the same
  // "separate call, not a profile-table column" way as
  // teacherAssignments/parentChildren above — but the level itself and the
  // subject list ARE now editable via editLevelId/editSubjectIds below.
  studentEnrollments = signal<StudentEnrollmentRegistryEntry | null>(null);
  studentEnrollmentsLoading = signal(false);

  // --- Edit Details: academic level + subject assignment (Student only) ---
  academicLevels = signal<Level[]>([]);
  levelOptions = computed(() =>
    this.academicLevels().map((l) => ({ label: l.name, value: l.id })),
  );
  // Subjects scoped to whichever level is currently picked in
  // the dialog — the default-mode pool (requirement: "By default, the
  // Subject Multi-Select highlights/filters subjects matching the chosen
  // Primary Level"). Sourced from GET .../offered-subjects (BatchSubject),
  // never the raw catalog — only an actual offered-subjects row says
  // whether a subject is really running for the chosen batch.
  levelSubjects = signal<BatchSubject[]>([]);
  levelSubjectsLoading = signal(false);
  // The single "current" Batch — the global default (Registry-wide
  // "active" batch), used only as the Edit Details cascade's starting
  // point below when a Student has no enrollment yet to infer a Batch
  // from. Loaded once, like academicLevels.
  currentBatchId = signal<string | null>(null);

  // --- Edit Details: Batch -> Level -> Subject cascade (Student only) ---
  // Batch is now an explicit, editable first stage of the cascade — same
  // Batch dropdown shape as the Add Teacher / Add Student cascades
  // (newTeacherBatchOptions / newStudentBatchId's sibling pattern), backed
  // by the same allBatches list. Previously this stage was implicit and
  // pinned to whichever Batch was flagged is_current server-side; a
  // Student's subject enrollments (Enrollment rows) actually carry their
  // OWN batch_id per subject, so pinning to "the" current batch meant an
  // Admin could never manage a Student's enrollment in any other batch
  // (e.g. correcting a subject that was mistakenly enrolled against last
  // year's batch). Selecting a Batch here re-scopes the offered-subjects
  // pool (loadLevelSubjects below) to THAT batch, and Save now resends the
  // chosen batch_id explicitly instead of the backend re-resolving
  // "whichever batch is_current" on its own.
  editBatchId = signal<string | null>(null);
  editBatchOptions = computed(() =>
    this.allBatches().map((b) => ({ label: b.name, value: b.id })),
  );

  // Cross-Level Subject Enrollment: "Show All Levels" toggle. Off by
  // default (matches the requirement above); flipping it on swaps the
  // multi-select's option pool from levelSubjects (this level only) to
  // every subject across every level, each one tagged with its own level
  // so a cross-level pick is unambiguous — "Mathematics [A-Level]" next
  // to "Physics [O-Level]" in the same list.
  crossLevelMode = signal(false);
  allSubjects = signal<Subject[]>([]);
  allSubjectsLoading = signal(false);
  private allSubjectsLoaded = false;

  subjectOptions = computed(() => {
    if (this.crossLevelMode()) {
      const levelNameById = new Map(this.academicLevels().map((l) => [l.id, l.name]));
      return this.allSubjects().map((s) => {
        const levelTag = levelNameById.get(s.level_id) ?? 'Unknown Level';
        return { label: `${s.name} [${levelTag}]`, value: s.id };
      });
    }
    return this.levelSubjects().map((s) => ({ label: s.subject_name, value: s.subject_id }));
  });

  editLevelId = signal<string | null>(null);
  editSubjectIds = signal<string[]>([]);

  // Parent options for the "link to parent" picker, shared by the Add User
  // dialog (Student role) and the standalone Link Parent dialog.
  allParents = signal<RegistryUser[]>([]);
  parentOptions = computed(() =>
    this.allParents().map((p) => ({ label: `${p.full_name} (${p.email})`, value: p.id })),
  );
  newParentId = signal<string | null>(null);
  newRelationshipLabel = signal('');

  // Standalone "Link Parent" dialog — connects an already-existing Parent
  // to an already-existing Student, independent of account creation.
  linkParentDialogOpen = signal(false);
  linkParentStudent = signal<RegistryUser | null>(null);
  linkParentSelectedId = signal<string | null>(null);
  linkParentRelationship = signal('');
  linkParentSubmitting = signal(false);

  isAdmin = computed(() => this.authService.currentUser()?.role === 'admin');
  currentUserId = computed(() => this.authService.currentUser()?.id ?? null);
  editPhoneNumber = signal('');
  editRollNumber = signal('');
  editAdmissionDate = signal<Date | null>(null);
  editFatherName = signal('');
  editDateOfBirth = signal<Date | null>(null);
  editGender = signal('');
  editReligion = signal('');
  editNationality = signal('');
  editCnic = signal('');
  // Registration ID is now only ever edited for a Parent — the Student
  // form's Registration ID control has been removed entirely (it was
  // already read-only/system-generated here).
  editRegistrationId = signal('');
  editHireDate = signal<Date | null>(null);
  editTeacherCode = signal('');

  constructor(
    private registryService: RegistryService,
    private authService: AuthService,
    private academicService: AcademicService,
    private academicsStaffService: AcademicsStaffService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadParentOptions();
    this.loadAcademicLevels();
    this.loadCurrentBatch();
    this.loadAllBatches();
    this.loadActiveBatches();

    // Admin Dashboard's "Add New User" Quick Action deep-links here with
    // ?action=add-user so the dialog opens immediately instead of making
    // the Admin click "Add User" again after already clicking a shortcut
    // for exactly that.
    if (this.route.snapshot.queryParamMap.get('action') === 'add-user') {
      this.openAddDialog();
    }
  }

  /** Populates the "link to parent" dropdown used by both the Add User
   *  (Student) dialog and the standalone Link Parent dialog, and doubles
   *  as the lookup source for parentNameFor() below — the backend's
   *  ParentStudentLinkOut only returns parent_id, not a joined name, so
   *  resolving "which parent is this" for the Student's read-only Linked
   *  Parent(s) section happens client-side against this same list rather
   *  than requiring a third backend endpoint just for a name lookup. */
  loadParentOptions(): void {
    this.registryService.getUsers('parent').subscribe({
      next: (parents) => this.allParents.set(parents),
    });
  }

  parentNameFor(parentId: string): string {
    return this.allParents().find((p) => p.id === parentId)?.full_name ?? 'Unknown parent';
  }

  /** Populates the Edit Details level picker for Students. Loaded once at
   *  startup, same as loadParentOptions — the list of levels is small and
   *  effectively static, so there's no need to refetch per dialog open. */
  loadAcademicLevels(): void {
    this.academicService.getLevels().subscribe({
      next: (levels) => this.academicLevels.set(levels),
    });
  }

  /** The "current" Batch, resolved once at startup — see currentBatchId's
   *  own comment for why this has to be the same batch PATCH /users/{id}
   *  writes enrollments against. */
  loadCurrentBatch(): void {
    this.academicService.getCurrentBatch().subscribe({
      next: (batch) => this.currentBatchId.set(batch?.id ?? null),
    });
  }

  /** Every Batch (not just the current one) — source for the Add Teacher
   *  cascade's Batch stage (Admin Teacher Creation point 2). Unlike
   *  currentBatchId above, a new Teacher's optional initial assignment
   *  isn't pinned to "the" current batch, so the Admin picks explicitly. */
  loadAllBatches(): void {
    this.academicsStaffService.getBatches().subscribe({
      next: (batches) => this.allBatches.set(batches),
    });
  }

  /** Source for the Add Student cascade's Batch stage — active batches
   *  only (backend-filtered via active_only=true), so the "Initial
   *  Enrollment" dropdown never offers an inactive/completed batch. */
  loadActiveBatches(): void {
    this.academicsStaffService.getBatches(true).subscribe({
      next: (batches) => this.activeBatches.set(batches),
    });
  }

  /** Batch handler for the Add Teacher initial-assignment cascade: resets
   *  the Subject stage below it and fetches this batch's offered (active)
   *  subjects — Subject narrowing happens client-side
   *  from there, against whichever Level(s) the teacher is qualified for
   *  (newTeacherLevelIds, set independently below — a teacher's Level
   *  qualification doesn't reset just because a different Batch is picked
   *  for the optional initial assignment). This cascade only needs
   *  Batch -> Subject, filtered by the teacher's selected Level(s). */
  onNewTeacherBatchChange(batchId: string | null): void {
    this.newTeacherBatchId.set(batchId);
    this.newTeacherSubjectIds.set([]);
    this.newTeacherOfferedSubjects.set([]);
    if (!batchId) return;
    this.newTeacherOfferedSubjectsLoading.set(true);
    this.academicService.getOfferedSubjects(batchId).subscribe({
      next: (offered) => {
        this.newTeacherOfferedSubjects.set(offered);
        this.newTeacherOfferedSubjectsLoading.set(false);
      },
      error: () => this.newTeacherOfferedSubjectsLoading.set(false),
    });
  }

  /** Multi-Level Teacher Assignment: handler for the Levels Taught
   *  multi-select — purely narrows newTeacherSubjectOptions (computed
   *  above) to whichever level(s) are now selected; no refetch needed
   *  since newTeacherOfferedSubjects already holds every offered subject
   *  for the chosen batch across all levels. Clears any already-picked
   *  Subjects whenever the level set changes, since a subject picked
   *  against a level that's just been deselected would otherwise silently
   *  ride along in the submission. */
  onNewTeacherLevelsChange(levelIds: string[]): void {
    this.newTeacherLevelIds.set(levelIds);
    this.newTeacherSubjectIds.set([]);
  }

  /** Batch stage handler for the Add Student Cascading Scope — mirrors
   *  onNewTeacherBatchChange above exactly, just against the Student's own
   *  set of signals so picking a batch in one form never disturbs the
   *  other. Level/Subject narrow the offered-subjects list down from
   *  there. */
  onNewStudentBatchChange(batchId: string | null): void {
    this.newStudentBatchId.set(batchId);
    this.newStudentLevelId.set(null);
    this.newStudentSubjectIds.set([]);
    this.newStudentOfferedSubjects.set([]);
    if (!batchId) return;
    this.newStudentOfferedSubjectsLoading.set(true);
    this.academicService.getOfferedSubjects(batchId).subscribe({
      next: (offered) => {
        this.newStudentOfferedSubjects.set(offered);
        this.newStudentOfferedSubjectsLoading.set(false);
      },
      error: () => this.newStudentOfferedSubjectsLoading.set(false),
    });
  }

  /** Level stage handler for the Add Student cascade — purely narrows
   *  newStudentSubjectOptions (computed above) to this level; no refetch
   *  needed, same "narrow client-side, no refetch" reasoning as
   *  onNewTeacherLevelsChange above (Student keeps a single-select Level
   *  stage — only the Teacher form moved to multi-level). */
  onNewStudentLevelChange(levelId: string | null): void {
    this.newStudentLevelId.set(levelId);
    this.newStudentSubjectIds.set([]);
  }

  /** Refetches the subject list scoped to `levelId` and the
   *  currently-picked `editBatchId()`: a subject can never be picked
   *  unless it's an actual active offering (batch_subjects) for the
   *  CHOSEN batch, at this level. Previously scoped to level only
   *  (GET /academic/subjects?level_id=), and before Batch became an
   *  explicit cascade stage, this was hard-pinned to whichever batch was
   *  flagged is_current, so a subject only offered in a different batch
   *  couldn't be reached at all.
   *  Requires editBatchId() to already be resolved; if it isn't ready yet
   *  (e.g. this fires from one of two independent in-flight requests when
   *  the dialog first opens), this safely no-ops to an empty list — the
   *  other request's completion re-calls this with everything
   *  available. */
  loadLevelSubjects(levelId: string | null): void {
    const batchId = this.editBatchId();
    if (!levelId || !batchId) {
      this.levelSubjects.set([]);
      return;
    }
    this.levelSubjectsLoading.set(true);
    this.academicService.getOfferedSubjects(batchId).subscribe({
      next: (offered) => {
        this.levelSubjects.set(offered.filter((s) => s.level_id === levelId));
        this.levelSubjectsLoading.set(false);
      },
      error: () => this.levelSubjectsLoading.set(false),
    });
  }

  /** Batch stage handler for the Edit Details cascade — switching Batch
   *  re-scopes the offered-subjects pool to the newly-picked batch. In
   *  default (non-cross-level) mode the previous subject selection is
   *  cleared first (a subject offered in one batch isn't necessarily
   *  offered in another), mirroring onEditLevelChange below;
   *  cross-level mode's subject pool (allSubjects) isn't
   *  batch-scoped at all, so nothing is cleared there. Level is left
   *  untouched — a Student's academic level doesn't depend on which
   *  batch their subject enrollment is being managed against. */
  onEditBatchChange(batchId: string | null): void {
    this.editBatchId.set(batchId);
    if (!this.crossLevelMode()) {
      this.editSubjectIds.set([]);
    }
    this.loadLevelSubjects(this.editLevelId());
  }

  /** Fired when the Admin changes the level dropdown inside Edit Details.
   *  In default (non-cross-level) mode, changing the level invalidates the
   *  previous subject selection (a subject valid for O-Level isn't valid
   *  for A-Level), so the selection is cleared and the subject options are
   *  reloaded for the new level. In cross-level mode the subject pool is
   *  already "every subject, every level" and doesn't depend on which
   *  level is picked here, so the selection is left alone — only the
   *  background levelSubjects list is refreshed, ready for if the Admin
   *  later switches cross-level back off. */
  onEditLevelChange(levelId: string | null): void {
    this.editLevelId.set(levelId);
    if (!this.crossLevelMode()) {
      this.editSubjectIds.set([]);
    }
    this.loadLevelSubjects(levelId);
  }

  /** Refetches every subject across every level, once, then caches it —
   *  the full list is small and effectively static (same reasoning as
   *  loadAcademicLevels), so there's no need to refetch on every toggle
   *  flip within the same session. */
  private loadAllSubjects(): void {
    if (this.allSubjectsLoaded) return;
    this.allSubjectsLoading.set(true);
    this.academicService.getSubjects().subscribe({
      next: (subjects) => {
        this.allSubjects.set(subjects);
        this.allSubjectsLoaded = true;
        this.allSubjectsLoading.set(false);
      },
      error: () => this.allSubjectsLoading.set(false),
    });
  }

  /** "Show All Levels / Allow Cross-Level Subjects" toggle. Turning it on
   *  loads the full subject list (if not already cached) so the
   *  multi-select can offer every level-tagged subject. Turning it back
   *  off doesn't discard a cross-level pick that's already selected —
   *  those stay selected and saved as-is (the backend accepts any
   *  subject_id regardless of level, per PATCH /users/{user_id}); it just
   *  narrows what NEW picks are offered back down to the current level. */
  onCrossLevelToggle(enabled: boolean): void {
    this.crossLevelMode.set(enabled);
    if (enabled) this.loadAllSubjects();
  }

  onRoleFilterChanged(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.registryService.getUsers(this.roleFilter() ?? undefined).subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the Information Registry right now.');
        this.loading.set(false);
      },
    });
  }

  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' {
    if (status === 'active') return 'success';
    if (status === 'pending') return 'warn';
    if (status === 'suspended') return 'danger';
    return 'secondary';
  }

  roleLabel(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  // ---------------------------------------------------------------------
  // Field-level format validation (Phone Number / CNIC). Both fields stay
  // optional — an empty value is always valid — but once something is
  // typed in, it must match the strict pattern. Used both for the inline
  // template error messages and as a submit-time gate in
  // submitAddUser()/submitEditDetails() below.
  // ---------------------------------------------------------------------
  isPhoneNumberValid(value: string): boolean {
    const trimmed = value.trim();
    return !trimmed || PHONE_NUMBER_PATTERN.test(trimmed);
  }

  isCnicValid(value: string): boolean {
    const trimmed = value.trim();
    return !trimmed || CNIC_PATTERN.test(trimmed);
  }

  // ---------------------------------------------------------------------
  // Add User
  // ---------------------------------------------------------------------
  openAddDialog(): void {
    this.newFullName.set('');
    this.newEmail.set('');
    this.newRole.set(null);
    this.newPhoneNumber.set('');
    this.newAdmissionDate.set(null);
    this.newFatherName.set('');
    this.newDateOfBirth.set(null);
    this.newGender.set('');
    this.newReligion.set('');
    this.newNationality.set('');
    this.newCnic.set('');
    this.newRegistrationId.set('');
    this.newHireDate.set(null);
    this.newParentId.set(null);
    this.newRelationshipLabel.set('');
    this.newParentLinkMode.set('later');
    this.newSetInitialPassword.set(false);
    this.newInitialPassword.set('');
    this.newInitialPasswordConfirm.set('');
    // Add Teacher cascade (Batch -> Subject, filtered by Levels Taught) — reset every stage.
    this.newTeacherBatchId.set(null);
    this.newTeacherLevelIds.set([]);
    this.newTeacherSubjectIds.set([]);
    this.newTeacherOfferedSubjects.set([]);
    // Add Student Cascading Scope (Batch -> Level -> Subject) — reset
    // every stage, same as the Teacher cascade above.
    this.newStudentBatchId.set(null);
    this.newStudentLevelId.set(null);
    this.newStudentSubjectIds.set([]);
    this.newStudentOfferedSubjects.set([]);
    this.addDialogOpen.set(true);
  }

  /** Parent Link Flow: switching to "Link Later" clears whatever parent
   *  was picked while "Link Existing Parent" was selected, so a stale
   *  parent_id/relationship never silently rides along into a submission
   *  that's supposed to defer linking entirely. */
  onNewParentLinkModeChange(mode: 'existing' | 'later'): void {
    this.newParentLinkMode.set(mode);
    if (mode === 'later') {
      this.newParentId.set(null);
      this.newRelationshipLabel.set('');
    }
  }

  submitAddUser(): void {
    const fullName = this.newFullName().trim();
    const email = this.newEmail().trim();
    const role = this.newRole();

    if (!fullName || !email || !role) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Full name, email, and role are all required.' });
      return;
    }
    // Strict format validation — Phone Number and CNIC stay optional, but
    // once typed in, must match the required pattern (mirrors the
    // backend's own validators) rather than round-tripping to a 422.
    if (!this.isPhoneNumberValid(this.newPhoneNumber())) {
      Swal.fire({ icon: 'warning', title: 'Invalid phone number', text: 'Phone Number must be a valid Pakistani mobile number, e.g. 03001234567 or +923001234567.' });
      return;
    }
    if (!this.isCnicValid(this.newCnic())) {
      Swal.fire({ icon: 'warning', title: 'Invalid CNIC', text: 'CNIC must be in the format 12345-1234567-1.' });
      return;
    }
    // Multi-Level Teacher Assignment: a Teacher must be qualified for at
    // least one academic level (e.g. O Level, AS Level, A Level Composite).
    if (role === 'teacher' && this.newTeacherLevelIds().length === 0) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Select at least one Level this Teacher is qualified to teach.' });
      return;
    }
    // Parent Link Flow: "Link Existing Parent" requires an actual parent
    // pick — mirrors the backend's UserCreate._validate_parent_link_flow
    // validator exactly, so a bad submission is caught here instead of
    // round-tripping to a 422.
    if (role === 'student' && this.newParentLinkMode() === 'existing' && !this.newParentId()) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Select a parent to link, or switch to "Link Later".' });
      return;
    }
    // Password Management: only validated/sent for non-Teacher roles —
    // matches UserCreate.initial_password being Optional server-side, so
    // leaving the toggle off reproduces today's pending+activation-email
    // behaviour exactly. A Teacher's password is never this component's
    // choice at all (see DEFAULT_TEACHER_INITIAL_PASSWORD server-side,
    // which the backend applies unconditionally for role === 'teacher'),
    // so the toggle/fields are hidden in the template for that role and
    // nothing here needs validating for it.
    let initialPassword: string | null = null;
    if (role !== 'teacher' && this.newSetInitialPassword()) {
      initialPassword = this.newInitialPassword();
      if (evaluatePasswordStrength(initialPassword).score < 5) {
        Swal.fire({
          icon: 'warning',
          title: 'Password too weak',
          text: 'Initial password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character.',
        });
        return;
      }
      if (initialPassword !== this.newInitialPasswordConfirm()) {
        Swal.fire({ icon: 'warning', title: "Passwords don't match", text: 'Initial password and confirmation must match.' });
        return;
      }
    }

    // Add Teacher cascade: Batch is optional (a new Teacher can be created
    // with no initial subject assignment at all), but once a Batch is
    // picked, at least one Subject is expected — otherwise the picked
    // Batch/Level silently do nothing, which is more likely a forgotten
    // step than an intentional "batch but no subjects" submission.
    const teacherBatchId = role === 'teacher' ? this.newTeacherBatchId() : null;
    const teacherSubjectIds = role === 'teacher' ? this.newTeacherSubjectIds() : [];
    if (teacherBatchId && teacherSubjectIds.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing info',
        text: 'Select at least one Subject for the chosen Batch, or clear the Batch to skip initial assignment.',
      });
      return;
    }

    // Add Student Cascading Scope: same "batch picked implies at least one
    // subject" rule as the Teacher cascade above — subject_ids requires
    // both batch_id and level_id server-side (UserCreate._validate_cascading_scope).
    const studentBatchId = role === 'student' ? this.newStudentBatchId() : null;
    const studentLevelId = role === 'student' ? this.newStudentLevelId() : null;
    const studentSubjectIds = role === 'student' ? this.newStudentSubjectIds() : [];
    if (studentBatchId && !studentLevelId) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Select a Level for the chosen Batch, or clear the Batch to skip initial enrollment.' });
      return;
    }
    if (studentSubjectIds.length > 0 && (!studentBatchId || !studentLevelId)) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'A Batch and Level are required before selecting Subjects.' });
      return;
    }

    this.addSubmitting.set(true);
    this.registryService
      .createUser({
        full_name: fullName,
        email,
        role,
        phone_number: this.newPhoneNumber() || null,
        // No roll_number here — Admin Student Creation, point 1: the
        // server always generates it (INK-{year}-XXXX); CreateUserRequest
        // doesn't even have a field for it any more.
        admission_date: role === 'student' && this.newAdmissionDate() ? this.toIsoDate(this.newAdmissionDate()!) : null,
        father_name: role === 'student' ? this.newFatherName() || null : null,
        date_of_birth: role === 'student' && this.newDateOfBirth() ? this.toIsoDate(this.newDateOfBirth()!) : null,
        gender: role === 'student' || role === 'teacher' ? this.newGender() || null : null,
        religion: role === 'student' ? this.newReligion() || null : null,
        nationality: role === 'student' ? this.newNationality() || null : null,
        cnic: role === 'student' || role === 'teacher' || role === 'parent' ? this.newCnic() || null : null,
        // Registration ID is only ever sent for a Parent now — the
        // Student form no longer has a control for it (system-generated,
        // same as Roll Number).
        registration_id: role === 'parent' ? this.newRegistrationId() || null : null,
        // Designation control has been removed entirely from the Teacher
        // form — no longer sent on create.
        hire_date: role === 'teacher' && this.newHireDate() ? this.toIsoDate(this.newHireDate()!) : null,
        // No teacher_code here — Admin Teacher Creation point 1: the
        // server always generates it (INK-T-XXXX); CreateUserRequest
        // doesn't even have a field for it any more.
        // Multi-Level Teacher Assignment: the level(s) this teacher is
        // qualified to teach, sent as an array of level UUIDs.
        level_ids: role === 'teacher' ? this.newTeacherLevelIds() : null,
        // Parent Link Flow: parent_link_mode is the explicit signal the
        // backend validates against; parent_id/relationship_label are only
        // meaningful (and only sent) when the mode is 'existing'.
        parent_link_mode: role === 'student' ? this.newParentLinkMode() : null,
        parent_id: role === 'student' && this.newParentLinkMode() === 'existing' ? this.newParentId() || null : null,
        relationship_label: role === 'student' && this.newParentLinkMode() === 'existing' ? this.newRelationshipLabel() || null : null,
        // Cascading Scope: optional initial Batch -> Level -> Subject
        // enrollment, same shape as the Teacher cascade handled below.
        batch_id: studentBatchId || null,
        level_id: studentLevelId || null,
        subject_ids: studentSubjectIds.length > 0 ? studentSubjectIds : null,
        initial_password: initialPassword,
      })
      .subscribe({
        next: (createdUser) => {
          // Initial subject assignment, if the Admin picked a Batch +
          // Subject(s) in the cascade above — same TeacherSubjectAssignment
          // row / same endpoint the Admin Batches screen's own
          // cascading-dropdown flow writes to (assign_teacher_to_batch's
          // docstring literally describes this cascade), so it shows up
          // immediately in the Information Registry with no separate sync
          // step. Fired after account creation succeeds; a failure here
          // doesn't roll back the account — it's a separate follow-up
          // action the Admin can always retry from Admin Batches.
          if (teacherBatchId && teacherSubjectIds.length > 0) {
            forkJoin(
              teacherSubjectIds.map((subjectId) =>
                this.academicsStaffService.assignTeacherToBatch(teacherBatchId, {
                  subject_id: subjectId,
                  teacher_id: createdUser.id,
                }),
              ),
            ).subscribe({
              next: () => {
                this.addSubmitting.set(false);
                this.addDialogOpen.set(false);
                Swal.fire({
                  icon: 'success',
                  title: 'Account created',
                  text: `${fullName} has been added as Teacher with the default password (Inkling@2026) — they'll be prompted to change it on first login. Initial subject assignment saved.`,
                  confirmButtonColor: '#101d3c',
                });
                this.loadUsers();
              },
              error: (err) => {
                this.addSubmitting.set(false);
                this.addDialogOpen.set(false);
                Swal.fire({
                  icon: 'warning',
                  title: 'Account created, but assignment failed',
                  text: err?.error?.detail ??
                    `${fullName} was added as Teacher, but the initial subject assignment could not be saved. Assign subjects from Admin Batches instead.`,
                });
                this.loadUsers();
              },
            });
            return;
          }
          this.addSubmitting.set(false);
          this.addDialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: 'Account created',
            text: role === 'teacher'
              ? `${fullName} has been added as Teacher with the default password (Inkling@2026) — they'll be prompted to change it on first login.`
              : role === 'student'
                ? `${fullName} has been added as Student with an auto-generated Roll Number and the default password (Inkling@2026) — they'll be prompted to change it on first login.${
                    this.newParentLinkMode() === 'later' ? ' No parent linked yet — use "Link Parent" whenever you\'re ready.' : ''
                  }`
                : initialPassword
                  ? `${fullName} has been added as ${this.roleLabel(role)} with the temporary password you set — they'll be prompted to change it on first login.`
                  : `${fullName} has been added as ${this.roleLabel(role)} — an activation email has been sent (console-logged for now).`,
            confirmButtonColor: '#101d3c',
          });
          this.loadUsers();
        },
        error: (err) => {
          this.addSubmitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not create account',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
  }

  // ---------------------------------------------------------------------
  // Edit Role
  // ---------------------------------------------------------------------
  openEditRoleDialog(user: RegistryUser): void {
    if (user.role === 'admin') {
      Swal.fire({
        icon: 'info',
        title: "Can't reassign Admin",
        text: 'Admin accounts are managed directly in the database and cannot be reassigned here.',
      });
      return;
    }
    if (user.role === 'coordinator' && !this.isAdmin()) {
      Swal.fire({
        icon: 'info',
        title: "Can't reassign a Coordinator",
        text: "Only Admin can change a Coordinator's role.",
      });
      return;
    }
    this.editingUser.set(user);
    this.editRoleValue.set(user.role as AssignableRole);
    this.editRoleDialogOpen.set(true);
  }

  submitEditRole(): void {
    const user = this.editingUser();
    const newRole = this.editRoleValue();
    if (!user || !newRole) return;

    if (newRole === user.role) {
      this.editRoleDialogOpen.set(false);
      return;
    }

    this.editRoleSubmitting.set(true);
    this.registryService.updateUser(user.id, { role: newRole }).subscribe({
      next: () => {
        this.editRoleSubmitting.set(false);
        this.editRoleDialogOpen.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Role updated',
          text: `${user.full_name} is now ${this.roleLabel(newRole)}.`,
          confirmButtonColor: '#101d3c',
        });
        this.loadUsers();
      },
      error: (err) => {
        this.editRoleSubmitting.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not change role',
          text: err?.error?.detail ?? 'Something went wrong. Please try again.',
        });
      },
    });
  }

  // ---------------------------------------------------------------------
  // Edit Details (registry fields — father's name, DOB, CNIC, etc.)
  // ---------------------------------------------------------------------
  openEditDetailsDialog(user: RegistryUser): void {
    if (user.role === 'admin' || user.role === 'coordinator') {
      Swal.fire({
        icon: 'info',
        title: 'Nothing to edit here',
        text: 'Admin and Coordinator accounts have no extra registry fields — just the base account info.',
      });
      return;
    }
    this.editDetailsUser.set(null);
    this.editDetailsLoading.set(true);
    this.editDetailsDialogOpen.set(true);
    this.teacherAssignments.set([]);
    this.parentChildren.set([]);
    this.studentParents.set([]);
    this.studentEnrollments.set(null);
    this.editBatchId.set(null);
    this.editLevelId.set(null);
    this.editSubjectIds.set([]);
    this.levelSubjects.set([]);
    this.crossLevelMode.set(false);

    if (user.role === 'teacher') {
      this.teacherAssignmentsLoading.set(true);
      this.registryService.getTeacherAssignments(user.id).subscribe({
        next: (rows) => {
          this.teacherAssignments.set(rows);
          this.teacherAssignmentsLoading.set(false);
        },
        error: () => this.teacherAssignmentsLoading.set(false),
      });
    } else if (user.role === 'parent') {
      this.parentChildrenLoading.set(true);
      this.registryService.getParentChildren(user.id).subscribe({
        next: (rows) => {
          this.parentChildren.set(rows);
          this.parentChildrenLoading.set(false);
        },
        error: () => this.parentChildrenLoading.set(false),
      });
    } else if (user.role === 'student') {
      this.studentParentsLoading.set(true);
      this.registryService.getParentsForStudent(user.id).subscribe({
        next: (rows) => {
          this.studentParents.set(rows);
          this.studentParentsLoading.set(false);
        },
        error: () => this.studentParentsLoading.set(false),
      });

      this.studentEnrollmentsLoading.set(true);
      this.registryService.getStudentEnrollments(user.id).subscribe({
        next: (data) => {
          this.studentEnrollments.set(data);
          this.studentEnrollmentsLoading.set(false);
          // Prefill the editable level + subject fields from the same
          // data — deliberately NOT going through onEditLevelChange here,
          // since that clears the selection (correct when the Admin
          // switches levels, wrong when we're just loading current state).
          this.editLevelId.set(data.current_level_id);
          const activeSubjects = data.subjects.filter((s) => s.status === 'active');
          this.editSubjectIds.set(activeSubjects.map((s) => s.subject_id));
          // Batch stage prefill: infer it from an existing active subject
          // enrollment (each Enrollment row carries its own batch_id) so
          // reopening this dialog lands back on whichever batch the
          // Student is actually enrolled against — not necessarily
          // today's global "current" batch. Falls back to currentBatchId
          // only when there's no enrollment yet to infer one from (a
          // brand-new Student), so the picker still starts on a sensible
          // default instead of empty.
          const enrolledBatchId = activeSubjects[0]?.batch_id ?? this.currentBatchId();
          this.editBatchId.set(enrolledBatchId ?? null);
          this.loadLevelSubjects(data.current_level_id);

          // Auto-enable cross-level mode if this student already has one —
          // otherwise the multi-select's default (level-scoped) pool
          // wouldn't include it, and the existing pick would look like it
          // silently vanished the moment this dialog opened.
          const hasCrossLevelSubject = activeSubjects.some(
            (s) => s.level_id && s.level_id !== data.current_level_id,
          );
          if (hasCrossLevelSubject) {
            this.onCrossLevelToggle(true);
          }
        },
        error: () => this.studentEnrollmentsLoading.set(false),
      });
    }

    this.registryService.getUser(user.id).subscribe({
      next: (detail) => {
        this.editDetailsUser.set(detail);
        this.editPhoneNumber.set(detail.phone_number ?? '');
        this.editRollNumber.set(detail.student_profile?.roll_number ?? '');
        this.editAdmissionDate.set(this.fromIsoDate(detail.student_profile?.admission_date));
        this.editFatherName.set(detail.student_profile?.father_name ?? '');
        this.editDateOfBirth.set(this.fromIsoDate(detail.student_profile?.date_of_birth));
        this.editGender.set(detail.student_profile?.gender ?? detail.teacher_profile?.gender ?? '');
        this.editReligion.set(detail.student_profile?.religion ?? '');
        this.editNationality.set(detail.student_profile?.nationality ?? '');
        this.editCnic.set(detail.student_profile?.cnic ?? detail.teacher_profile?.cnic ?? detail.parent_profile?.cnic ?? '');
        // Registration ID is only ever prefilled for a Parent now — the
        // Student form no longer has a control for it.
        this.editRegistrationId.set(detail.parent_profile?.registration_id ?? '');
        this.editHireDate.set(this.fromIsoDate(detail.teacher_profile?.hire_date));
        this.editTeacherCode.set(detail.teacher_profile?.teacher_code ?? '');
        // Same reasoning as the editLevelId/editBatchId prefill above: this
        // and the getStudentEnrollments call above race independently —
        // whichever of the two resolves last is the one that ends up with
        // editLevelId AND editBatchId both set, so the earlier one's call
        // is a harmless no-op (see loadLevelSubjects' own comment).
        if (detail.role === 'student') {
          this.loadLevelSubjects(this.editLevelId());
        }
        this.editDetailsLoading.set(false);
      },
      error: (err) => {
        this.editDetailsLoading.set(false);
        this.editDetailsDialogOpen.set(false);
        // Surface the backend's actual detail message (now specific —
        // "profile data is inconsistent", "User not found", etc. — see
        // GET /api/users/{id}) instead of a hardcoded generic string, same
        // pattern as every other error handler in this component.
        Swal.fire({
          icon: 'error',
          title: 'Could not load details',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  submitEditDetails(): void {
    const user = this.editDetailsUser();
    if (!user) return;

    // Strict format validation — same rule as Add User: optional, but must
    // match the required pattern once typed in.
    if (!this.isPhoneNumberValid(this.editPhoneNumber())) {
      Swal.fire({ icon: 'warning', title: 'Invalid phone number', text: 'Phone Number must be a valid Pakistani mobile number, e.g. 03001234567 or +923001234567.' });
      return;
    }
    if (!this.isCnicValid(this.editCnic())) {
      Swal.fire({ icon: 'warning', title: 'Invalid CNIC', text: 'CNIC must be in the format 12345-1234567-1.' });
      return;
    }
    // Batch -> Level -> Subject cascade: a Batch must be picked before any
    // subject can be assigned/saved against it — mirrors the backend's own
    // "Assign an academic level before assigning subjects" guard for Level.
    if (user.role === 'student' && this.editSubjectIds().length > 0 && !this.editBatchId()) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Select a Batch before assigning subjects.' });
      return;
    }

    this.editDetailsSubmitting.set(true);
    this.registryService
      .updateUser(user.id, {
        phone_number: this.editPhoneNumber() || null,
        roll_number: user.role === 'student' ? this.editRollNumber() || null : undefined,
        admission_date: user.role === 'student' && this.editAdmissionDate() ? this.toIsoDate(this.editAdmissionDate()!) : undefined,
        father_name: user.role === 'student' ? this.editFatherName() || null : undefined,
        date_of_birth: user.role === 'student' && this.editDateOfBirth() ? this.toIsoDate(this.editDateOfBirth()!) : undefined,
        gender: user.role === 'student' || user.role === 'teacher' ? this.editGender() || null : undefined,
        religion: user.role === 'student' ? this.editReligion() || null : undefined,
        nationality: user.role === 'student' ? this.editNationality() || null : undefined,
        cnic: this.editCnic() || null,
        // Registration ID is only ever sent for a Parent now — the
        // Student form no longer has a control for it.
        registration_id: user.role === 'parent' ? this.editRegistrationId() || null : undefined,
        // Designation control has been removed entirely from the Teacher
        // form — no longer sent on update.
        hire_date: user.role === 'teacher' && this.editHireDate() ? this.toIsoDate(this.editHireDate()!) : undefined,
        teacher_code: user.role === 'teacher' ? this.editTeacherCode() || null : undefined,
        // level_id left undefined (not null) when unset, so it's skipped
        // server-side rather than read as "clear the level" — a student
        // with no level assigned yet just has editLevelId() === null here.
        level_id: user.role === 'student' ? this.editLevelId() ?? undefined : undefined,
        // Batch -> Level -> Subject cascade: batch_id is now explicit and
        // always resent alongside subject_ids for a Student (never left to
        // the backend's own is_current fallback) — same undefined-when-
        // unset convention as level_id above.
        batch_id: user.role === 'student' ? this.editBatchId() ?? undefined : undefined,
        // subject_ids is always the full desired list for a Student (never
        // undefined), since Save always reflects the multi-select's current
        // state — including an intentional empty array to unassign everything.
        subject_ids: user.role === 'student' ? this.editSubjectIds() : undefined,
      })
      .subscribe({
        next: () => {
          this.editDetailsSubmitting.set(false);
          this.editDetailsDialogOpen.set(false);
          Swal.fire({ icon: 'success', title: 'Details updated', confirmButtonColor: '#101d3c' });
          this.loadUsers();
        },
        error: (err) => {
          this.editDetailsSubmitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not save details',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
  }

  // ---------------------------------------------------------------------
  // Status (suspend / reactivate)
  //
  // Suspension hierarchy ("Super Admin" = this system's Admin role, the
  // top tier — see users.py update_user for the backend-enforced mirror
  // of every rule below):
  //   1. Admin accounts can never be suspended/reactivated here, by
  //      anyone — including another Admin. That's a direct-database
  //      action, unchanged from before.
  //   2. A Coordinator cannot suspend/reactivate another Coordinator
  //      account — peers, not subordinates. Only Admin can.
  //   3. A Coordinator CAN still suspend/reactivate Teacher, Student, and
  //      Parent accounts.
  // canToggleStatus() mirrors these so the Suspend/Reactivate button is
  // hidden entirely rather than shown-then-blocked (same pattern as
  // canResetPassword() below) — toggleStatus() itself still re-checks
  // before calling the API, since the real enforcement is server-side.
  // ---------------------------------------------------------------------
  canToggleStatus(user: RegistryUser): boolean {
    if (user.status === 'pending') return false;
    if (user.role === 'admin') return false;
    if (user.role === 'coordinator') return this.isAdmin();
    return true;
  }

  toggleStatus(user: RegistryUser): void {
    if (user.role === 'admin') {
      Swal.fire({ icon: 'info', title: "Can't change Admin status", text: 'Admin accounts are managed directly in the database.' });
      return;
    }
    if (user.role === 'coordinator' && !this.isAdmin()) {
      Swal.fire({
        icon: 'info',
        title: "Can't change a Coordinator's status",
        text: 'Only Admin can suspend or reactivate a Coordinator account.',
      });
      return;
    }
    if (user.status === 'pending') {
      Swal.fire({ icon: 'info', title: 'Still pending activation', text: `${user.full_name} hasn't activated their account yet — nothing to suspend.` });
      return;
    }

    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'suspended' ? 'suspend' : 'reactivate';

    Swal.fire({
      icon: 'warning',
      title: `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${user.full_name}?`,
      showCancelButton: true,
      confirmButtonText: `Yes, ${verb}`,
      confirmButtonColor: '#101d3c',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.registryService.updateUser(user.id, { status: nextStatus }).subscribe({
        next: () => this.loadUsers(),
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: `Could not ${verb} account`,
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
    });
  }

  // ---------------------------------------------------------------------
  // Link Parent (standalone) — connects an existing Parent to an existing
  // Student, independent of the Add User creation flow. Distinct from the
  // "select a parent while creating a Student" path — this covers accounts
  // that already existed separately and need linking after the fact.
  // ---------------------------------------------------------------------
  openLinkParentDialog(student: RegistryUser): void {
    this.linkParentStudent.set(student);
    this.linkParentSelectedId.set(null);
    this.linkParentRelationship.set('');
    this.linkParentDialogOpen.set(true);
  }

  submitLinkParent(): void {
    const student = this.linkParentStudent();
    const parentId = this.linkParentSelectedId();
    if (!student || !parentId) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Select a parent to link.' });
      return;
    }

    this.linkParentSubmitting.set(true);
    this.registryService
      .createParentLink({
        parent_id: parentId,
        student_id: student.id,
        relationship_label: this.linkParentRelationship() || null,
      })
      .subscribe({
        next: () => {
          this.linkParentSubmitting.set(false);
          this.linkParentDialogOpen.set(false);
          Swal.fire({ icon: 'success', title: 'Linked', text: `Parent linked to ${student.full_name}.`, confirmButtonColor: '#101d3c' });
          // If the Edit Details dialog happens to be open for this same
          // student, refresh its read-only parent list too.
          if (this.editDetailsUser()?.id === student.id) {
            this.registryService.getParentsForStudent(student.id).subscribe((rows) => this.studentParents.set(rows));
          }
        },
        error: (err) => {
          this.linkParentSubmitting.set(false);
          Swal.fire({ icon: 'error', title: 'Could not link parent', text: err?.error?.detail ?? 'Something went wrong. Please try again.' });
        },
      });
  }

  // ---------------------------------------------------------------------
  // Parent Management (Student Edit Details): De-link Parent and Edit
  // Parent Details — explicit row-level actions next to each entry in the
  // Student's "Linked Parent(s)" list, replacing the old
  // view-only-until-you-leave-this-dialog treatment of that section. Both
  // act on the SAME studentParents() list rendered there, so no extra
  // fetch is needed to know which link/parent a click refers to.
  // ---------------------------------------------------------------------

  /** De-link Parent — soft-deletes the parent_student_links row connecting
   *  this Parent to this Student (DELETE /api/users/parent-links/{id}),
   *  the reverse of Link Parent / the "Link Existing Parent" creation-time
   *  flow. Does not touch either account itself — just the relationship —
   *  so both the Parent and the Student accounts stay exactly as they
   *  were, just no longer connected to each other. */
  delinkParent(link: ParentStudentLink): void {
    const student = this.editDetailsUser();
    const parentName = this.parentNameFor(link.parent_id);
    Swal.fire({
      icon: 'warning',
      title: `De-link ${parentName}?`,
      text: student ? `${parentName} will no longer be linked to ${student.full_name}. This can be redone later from Link Parent.` : undefined,
      showCancelButton: true,
      confirmButtonText: 'Yes, de-link',
      confirmButtonColor: '#c00000',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.registryService.deleteParentLink(link.id).subscribe({
        next: () => {
          this.studentParents.update((rows) => rows.filter((r) => r.id !== link.id));
          Swal.fire({ icon: 'success', title: 'Parent de-linked', confirmButtonColor: '#101d3c' });
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Could not de-link parent',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
    });
  }

  /** Edit Parent Details — jumps straight from a Student's "Linked
   *  Parent(s)" row into that same Parent account's own Edit Details
   *  dialog, sourcing the RegistryUser it needs from allParents() (already
   *  loaded for the link-picker dropdown, same lookup source as
   *  parentNameFor above) rather than requiring a separate fetch. Reuses
   *  openEditDetailsDialog wholesale — it fully resets every Edit Details
   *  signal itself, so re-invoking it while the dialog is already open for
   *  the Student simply repopulates it for the Parent instead. */
  editLinkedParent(link: ParentStudentLink): void {
    const parent = this.allParents().find((p) => p.id === link.parent_id);
    if (!parent) {
      Swal.fire({ icon: 'error', title: 'Could not open parent', text: 'This parent account could not be found — it may have been removed.' });
      return;
    }
    this.openEditDetailsDialog(parent);
  }

  // ---------------------------------------------------------------------
  // Delete (soft-delete) — Admin only on the backend; hidden in the UI for
  // Coordinator, and for the logged-in Admin's own row (can't delete self).
  // ---------------------------------------------------------------------
  deleteUser(user: RegistryUser): void {
    Swal.fire({
      icon: 'warning',
      title: `Delete ${user.full_name}?`,
      text: 'This soft-deletes the account — it can be restored from the database if needed, but will disappear from the Registry and lose portal access immediately.',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#c00000',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.registryService.deleteUser(user.id).subscribe({
        // Instant drop: update the signal directly from the confirmed
        // response instead of waiting on a full loadUsers() round-trip —
        // filteredUsers() (a computed() over `users`) re-derives
        // immediately, so the row (and, if this was a Teacher, every
        // dropdown/registry view reading off this same list) disappears
        // the moment deletion is confirmed, not on the next refresh.
        next: () => this.users.update((list) => list.filter((u) => u.id !== user.id)),
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Could not delete account',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
    });
  }

  // ---------------------------------------------------------------------
  // Reset Password — Admin/Coordinator sets a new temporary password for
  // someone else. canResetPassword() mirrors the backend's own rules
  // (users.py reset_user_password) purely so the button doesn't offer an
  // action that would just come back 403 — the real enforcement stays
  // server-side either way:
  //   1. Never your own row — self-service Change Password exists exactly
  //      because it requires proving you know the CURRENT password.
  //   2. A Coordinator can't reset an Admin's or another Coordinator's
  //      password — Admin-only for those targets.
  // ---------------------------------------------------------------------
  resetPasswordDialogOpen = signal(false);
  resetPasswordSubmitting = signal(false);
  resetPasswordUser = signal<RegistryUser | null>(null);
  resetPasswordValue = signal('');
  resetPasswordConfirmValue = signal('');

  // Live strength meter for the value being typed into the dialog above —
  // same 5 criteria as the backend's validate_password_strength
  // (app/schemas/common.py).
  resetPasswordStrength = computed(() => evaluatePasswordStrength(this.resetPasswordValue()));

  canResetPassword(user: RegistryUser): boolean {
    if (user.id === this.currentUserId()) return false;
    if (user.role === 'admin' || user.role === 'coordinator') return this.isAdmin();
    return true;
  }

  openResetPasswordDialog(user: RegistryUser): void {
    this.resetPasswordUser.set(user);
    this.resetPasswordValue.set('');
    this.resetPasswordConfirmValue.set('');
    this.resetPasswordDialogOpen.set(true);
  }

  submitResetPassword(): void {
    const user = this.resetPasswordUser();
    if (!user) return;

    const newPassword = this.resetPasswordValue();
    if (this.resetPasswordStrength().score < 5) {
      Swal.fire({
        icon: 'warning',
        title: 'Password too weak',
        text: 'New password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character.',
      });
      return;
    }
    if (newPassword !== this.resetPasswordConfirmValue()) {
      Swal.fire({ icon: 'warning', title: "Passwords don't match", text: 'New password and confirmation must match.' });
      return;
    }

    this.resetPasswordSubmitting.set(true);
    this.registryService.resetPassword(user.id, { new_password: newPassword }).subscribe({
      next: () => {
        this.resetPasswordSubmitting.set(false);
        this.resetPasswordDialogOpen.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Password reset',
          text: `${user.full_name} has a new temporary password and will be prompted to change it on next login.`,
          confirmButtonColor: '#101d3c',
        });
        this.loadUsers();
      },
      error: (err) => {
        this.resetPasswordSubmitting.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not reset password',
          text: err?.error?.detail ?? 'Something went wrong. Please try again.',
        });
      },
    });
  }

  private toIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private fromIsoDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    // "YYYY-MM-DD" parsed via `new Date(str)` reads as UTC midnight, which
    // can roll back a day in a timezone ahead of UTC (same class of bug as
    // the attendance filter fix) — build from parts instead.
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}