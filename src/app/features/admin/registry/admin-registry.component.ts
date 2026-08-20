import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
import {
  RegistryUser, RegistryUserDetail, AssignableRole,
  TeacherAssignmentRegistryEntry, ParentChildRegistryEntry, ParentStudentLink,
  StudentEnrollmentRegistryEntry,
} from '../../../core/models/registry.model';
import { Level, Subject } from '../../../core/models/academic.model';
import { Board } from '../../../core/models/enums';
import { BOARD_OPTIONS } from '../batches/admin-batches.component';

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
  newRollNumber = signal('');
  newAdmissionDate = signal<Date | null>(null);
  newFatherName = signal('');
  newDateOfBirth = signal<Date | null>(null);
  newGender = signal('');
  newReligion = signal('');
  newNationality = signal('');
  newCnic = signal('');
  newRegistrationId = signal('');
  newDesignation = signal('');
  newHireDate = signal<Date | null>(null);
  newTeacherCode = signal('');
  // schema_update_11: required Board fields — single-select for a Student
  // (the board they're registered under), multi-select for a Teacher (the
  // board(s) they're qualified to teach, at least one).
  newBoard = signal<Board | null>(null);
  newBoards = signal<Board[]>([]);
  boardOptions = BOARD_OPTIONS;
  // Password Management: Admin/Coordinator can optionally set the account's
  // initial password directly instead of the default email-activation-token
  // path. Off by default so unmodified behaviour (pending + activation
  // email) stays the default for every existing Add User submission.
  newSetInitialPassword = signal(false);
  newInitialPassword = signal('');
  newInitialPasswordConfirm = signal('');

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
  // Subjects scoped to whichever level is currently picked in the dialog —
  // the default-mode pool (requirement: "By default, the Subject
  // Multi-Select highlights/filters subjects matching the chosen Primary
  // Level").
  levelSubjects = signal<Subject[]>([]);
  levelSubjectsLoading = signal(false);

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
    return this.levelSubjects().map((s) => ({ label: s.name, value: s.id }));
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
  editRegistrationId = signal('');
  editDesignation = signal('');
  editHireDate = signal<Date | null>(null);
  editTeacherCode = signal('');
  editBoard = signal<Board | null>(null);
  editBoards = signal<Board[]>([]);

  constructor(
    private registryService: RegistryService,
    private authService: AuthService,
    private academicService: AcademicService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadParentOptions();
    this.loadAcademicLevels();

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

  /** Refetches the subject list scoped to `levelId` — the multi-select's
   *  options are always exactly this list, so a subject can never be picked
   *  unless it belongs to the currently-selected level. */
  loadLevelSubjects(levelId: string | null): void {
    if (!levelId) {
      this.levelSubjects.set([]);
      return;
    }
    this.levelSubjectsLoading.set(true);
    this.academicService.getSubjects(levelId).subscribe({
      next: (subjects) => {
        this.levelSubjects.set(subjects);
        this.levelSubjectsLoading.set(false);
      },
      error: () => this.levelSubjectsLoading.set(false),
    });
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
  // Add User
  // ---------------------------------------------------------------------
  openAddDialog(): void {
    this.newFullName.set('');
    this.newEmail.set('');
    this.newRole.set(null);
    this.newPhoneNumber.set('');
    this.newRollNumber.set('');
    this.newAdmissionDate.set(null);
    this.newFatherName.set('');
    this.newDateOfBirth.set(null);
    this.newGender.set('');
    this.newReligion.set('');
    this.newNationality.set('');
    this.newCnic.set('');
    this.newRegistrationId.set('');
    this.newDesignation.set('');
    this.newHireDate.set(null);
    this.newTeacherCode.set('');
    this.newBoard.set(null);
    this.newBoards.set([]);
    this.newParentId.set(null);
    this.newRelationshipLabel.set('');
    this.newSetInitialPassword.set(false);
    this.newInitialPassword.set('');
    this.newInitialPasswordConfirm.set('');
    this.addDialogOpen.set(true);
  }

  submitAddUser(): void {
    const fullName = this.newFullName().trim();
    const email = this.newEmail().trim();
    const role = this.newRole();

    if (!fullName || !email || !role) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Full name, email, and role are all required.' });
      return;
    }
    // schema_update_11: Board is required on the Student form (single) and
    // the Teacher form (at least one) — matches the backend's
    // UserCreate._require_board_for_role validator exactly, so a bad
    // submission is caught here instead of round-tripping to a 422.
    if (role === 'student' && !this.newBoard()) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Board is required for a Student.' });
      return;
    }
    if (role === 'teacher' && this.newBoards().length === 0) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Select at least one Board a Teacher is qualified to teach.' });
      return;
    }
    // Password Management: only validated/sent when the toggle is on —
    // matches UserCreate.initial_password being Optional server-side, so
    // leaving the toggle off reproduces today's pending+activation-email
    // behaviour exactly.
    let initialPassword: string | null = null;
    if (this.newSetInitialPassword()) {
      initialPassword = this.newInitialPassword();
      if (initialPassword.length < 8) {
        Swal.fire({ icon: 'warning', title: 'Password too short', text: 'Initial password must be at least 8 characters.' });
        return;
      }
      if (initialPassword !== this.newInitialPasswordConfirm()) {
        Swal.fire({ icon: 'warning', title: "Passwords don't match", text: 'Initial password and confirmation must match.' });
        return;
      }
    }

    this.addSubmitting.set(true);
    this.registryService
      .createUser({
        full_name: fullName,
        email,
        role,
        phone_number: this.newPhoneNumber() || null,
        roll_number: role === 'student' ? this.newRollNumber() || null : null,
        admission_date: role === 'student' && this.newAdmissionDate() ? this.toIsoDate(this.newAdmissionDate()!) : null,
        father_name: role === 'student' ? this.newFatherName() || null : null,
        date_of_birth: role === 'student' && this.newDateOfBirth() ? this.toIsoDate(this.newDateOfBirth()!) : null,
        gender: role === 'student' || role === 'teacher' ? this.newGender() || null : null,
        religion: role === 'student' ? this.newReligion() || null : null,
        nationality: role === 'student' ? this.newNationality() || null : null,
        cnic: role === 'student' || role === 'teacher' || role === 'parent' ? this.newCnic() || null : null,
        registration_id: role === 'student' || role === 'parent' ? this.newRegistrationId() || null : null,
        board: role === 'student' ? this.newBoard() : null,
        designation: role === 'teacher' ? this.newDesignation() || null : null,
        hire_date: role === 'teacher' && this.newHireDate() ? this.toIsoDate(this.newHireDate()!) : null,
        teacher_code: role === 'teacher' ? this.newTeacherCode() || null : null,
        boards: role === 'teacher' ? this.newBoards() : null,
        parent_id: role === 'student' ? this.newParentId() || null : null,
        relationship_label: role === 'student' ? this.newRelationshipLabel() || null : null,
        initial_password: initialPassword,
      })
      .subscribe({
        next: () => {
          this.addSubmitting.set(false);
          this.addDialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: 'Account created',
            text: initialPassword
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
    this.editLevelId.set(null);
    this.editSubjectIds.set([]);
    this.levelSubjects.set([]);
    this.crossLevelMode.set(false);
    this.editBoard.set(null);
    this.editBoards.set([]);

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
        this.editRegistrationId.set(detail.student_profile?.registration_id ?? detail.parent_profile?.registration_id ?? '');
        this.editDesignation.set(detail.teacher_profile?.designation ?? '');
        this.editHireDate.set(this.fromIsoDate(detail.teacher_profile?.hire_date));
        this.editTeacherCode.set(detail.teacher_profile?.teacher_code ?? '');
        this.editBoard.set(detail.student_profile?.board ?? null);
        // teacher_profile can legitimately come back null (e.g. a teacher
        // record whose profile row is missing server-side — now logged
        // there rather than silently dropped) — default to an empty list
        // either way so the Boards multi-select just starts unset instead
        // of failing to render.
        this.editBoards.set(detail.teacher_profile?.boards ?? []);
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

    // schema_update_11: same required-Board rule as Add User — a Student
    // edit always resends the (required) board, a Teacher edit always
    // resends at least one board.
    if (user.role === 'student' && !this.editBoard()) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Board is required for a Student.' });
      return;
    }
    if (user.role === 'teacher' && this.editBoards().length === 0) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Select at least one Board a Teacher is qualified to teach.' });
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
        registration_id: user.role === 'student' || user.role === 'parent' ? this.editRegistrationId() || null : undefined,
        board: user.role === 'student' ? this.editBoard() : undefined,
        designation: user.role === 'teacher' ? this.editDesignation() || null : undefined,
        hire_date: user.role === 'teacher' && this.editHireDate() ? this.toIsoDate(this.editHireDate()!) : undefined,
        teacher_code: user.role === 'teacher' ? this.editTeacherCode() || null : undefined,
        boards: user.role === 'teacher' ? this.editBoards() : undefined,
        // level_id left undefined (not null) when unset, so it's skipped
        // server-side rather than read as "clear the level" — a student
        // with no level assigned yet just has editLevelId() === null here.
        level_id: user.role === 'student' ? this.editLevelId() ?? undefined : undefined,
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
  // ---------------------------------------------------------------------
  toggleStatus(user: RegistryUser): void {
    if (user.role === 'admin') {
      Swal.fire({ icon: 'info', title: "Can't change Admin status", text: 'Admin accounts are managed directly in the database.' });
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
        next: () => this.loadUsers(),
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
    if (newPassword.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Password too short', text: 'New password must be at least 8 characters.' });
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
