import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { UserService } from '../../../core/services/user.service';
import { Batch, Level, Subject, OfferedSubject } from '../../../core/models/academic.model';
import { TeacherAssignment } from '../../../core/models/academics-staff.model';
import { User } from '../../../core/models/user.model';
import { UserRole, Board } from '../../../core/models/enums';
import { BOARD_OPTIONS } from '../../../shared/utils/board-options.util';
import { isAssignableTeacher } from '../../../shared/utils/active-teacher.util';

/**
 * Admin/Coordinator: Manage Subjects &amp; Teachers for one Batch.
 *
 * Presentational-ish, but — unlike BatchSummaryDialogComponent — this one
 * owns its own data loading (levels / catalog subjects / offered subjects
 * / teacher registry) because it has real write actions of its own,
 * rather than just rendering whatever the parent hands it. The parent
 * (AdminBatchesComponent) only owns `visible` and `batch`.
 *
 * Two distinct sources of "subjects", by design, not oversight:
 *  - "Offer Subjects" picks from the full catalog (GET
 *    /api/academic/subjects?level_id=) — you're deciding what SHOULD be
 *    offered, so the not-yet-offered ones have to be selectable too.
 *  - "Assign Teacher" picks from GET .../offered-subjects — you can only
 *    assign a teacher to a subject that's actually running in this batch
 *    already, per the backend's own contract (assign-teacher doesn't
 *    validate against batch_subjects, but offering it first is the
 *    intended flow, and it's the only list the offered-subjects endpoint
 *    can honestly represent).
 * Both cascade off the same Level dropdown AND the Board dropdown
 * (schema_update_15): a batch isn't tied to one board, so every offering
 * and every teacher assignment needs its Board context picked explicitly
 * (or pre-filled from the Board Tab the admin opened this dialog from —
 * see `defaultBoard` below) rather than assumed from the batch itself.
 *
 * Follows this codebase's established pattern (signals + FormsModule
 * `[ngModel]`/`(ngModelChange)`, see AdminBatchesComponent /
 * AdminRegistryComponent) rather than ReactiveFormsModule/FormGroup,
 * which isn't used anywhere else in the app — introducing a second forms
 * paradigm for one dialog isn't worth the inconsistency.
 *
 * Multiple teachers per subject: the backend has always allowed a
 * subject+batch to have more than one teacher assigned (the unique
 * constraint on teacher_subject_assignments is teacher+subject+batch, not
 * just subject+batch) — this dialog previously just never showed who was
 * already assigned, which made it look like only one teacher was
 * possible. Picking a subject in "Assign Teacher" now also loads and
 * displays its current teacher(s) (assignedTeachers/assignedTeacherNames
 * below), refreshed after each successful assignment, so adding a second
 * or third teacher to the same subject is visible as it happens rather
 * than only discoverable via the Information Registry afterward.
 */
@Component({
  selector: 'app-manage-batch-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DialogModule, SelectModule, MultiSelectModule,
    ButtonModule, MessageModule, ProgressSpinnerModule, TagModule,
  ],
  templateUrl: './manage-batch-dialog.component.html',
  styleUrl: './manage-batch-dialog.component.scss',
})
export class ManageBatchDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() batch: Batch | null = null;
  /** Board Tab the parent had selected when "Manage" was clicked (null on
   *  the "All Boards" tab) — used only to pre-fill the Board dropdown
   *  below; the admin can still change it. */
  @Input() defaultBoard: Board | null = null;

  boardOptions = BOARD_OPTIONS;

  @Output() closed = new EventEmitter<void>();
  /** Emitted after any successful "Save Offered Subjects" or "Assign
   *  Teacher to Subject" — either can change what the Batches table's
   *  Board tabs show (assigned_teachers_count in particular feeds that
   *  filter), so the parent should reload its batch list on this. */
  @Output() saved = new EventEmitter<void>();

  levels = signal<Level[]>([]);
  loadingLevels = signal(false);

  // Full subject catalog for the selected level — "Offer Subjects" source.
  catalogSubjects = signal<Subject[]>([]);
  loadingCatalogSubjects = signal(false);

  // Subjects actually offered on this batch (any level) — "Assign
  // Teacher" source, filtered client-side by selectedLevelId below.
  offeredSubjects = signal<OfferedSubject[]>([]);
  loadingOffered = signal(false);

  teachers = signal<User[]>([]);
  loadingTeachers = signal(false);

  /** "Assign Teacher" picker source. Deleted teachers already never reach
   *  `teachers()` (GET /api/users?role=teacher filters deleted_at
   *  server-side) — this additionally drops SUSPENDED teachers, who still
   *  exist but shouldn't be assignable to new work. `assignedTeacherNames`
   *  below deliberately keeps reading off the unfiltered `teachers()` so
   *  an already-assigned-but-now-suspended teacher's name still resolves
   *  in the "Currently Assigned" chips — this filter only narrows the
   *  *pickable* list. */
  assignableTeachers = computed(() => this.teachers().filter(isAssignableTeacher));

  // --- cascading selection state ---
  // schema_update_15: Board is now a third axis alongside Level — a batch
  // can have the same subject offered under multiple boards, so both
  // "Offer Subjects" and "Assign Teacher" need an explicit board context,
  // not just a level.
  selectedBoard = signal<Board | null>(null);
  selectedLevelId = signal<string | null>(null);
  selectedSubjectIdsToOffer = signal<string[]>([]);
  selectedAssignSubjectId = signal<string | null>(null);
  selectedTeacherId = signal<string | null>(null);

  savingOffered = signal(false);
  assigningTeacher = signal(false);

  // --- Currently Assigned Teachers (for the subject picked below) ---
  // Multiple different teachers CAN already be assigned to the same
  // subject+batch — the backend has never blocked that (unique constraint
  // is teacher+subject+batch, not just subject+batch). The dialog simply
  // never showed who was already assigned, which made "assign a second
  // teacher" look unsupported even though POST .../assign-teacher already
  // allowed it. This surfaces that existing state instead of adding new
  // backend capability.
  assignedTeachers = signal<TeacherAssignment[]>([]);
  loadingAssignedTeachers = signal(false);

  assignedTeacherNames = computed(() => {
    const teachersById = new Map(this.teachers().map((t) => [t.id, t.full_name]));
    // A teacher can appear more than once in assignedTeachers() (once per
    // active board — see TeacherAssignment.board's own docstring); collapse
    // to one name per distinct teacher_id for display here.
    const seen = new Set<string>();
    const names: string[] = [];
    for (const a of this.assignedTeachers()) {
      if (seen.has(a.teacher_id)) continue;
      seen.add(a.teacher_id);
      names.push(teachersById.get(a.teacher_id) ?? 'Unknown teacher');
    }
    return names;
  });

  /** Subjects offered on this batch for the currently selected Level AND
   *  Board — the source list for "Assign Teacher" (schema_update_15: the
   *  same subject can be offered twice, once per board, so filtering by
   *  level alone is no longer enough to know which offering — and which
   *  board — a teacher is being assigned under). */
  offeredSubjectsForLevel = computed(() => {
    const board = this.selectedBoard();
    return this.offeredSubjects().filter(
      (s) => s.level_id === this.selectedLevelId() && (!board || s.board === board),
    );
  });

  constructor(
    private academicsStaffService: AcademicsStaffService,
    private userService: UserService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Reload everything fresh each time the dialog opens for a batch —
    // covers both "opened for the first time" and "closed, then reopened
    // for a different row" (batch input can change while visible flips).
    if (changes['visible'] && this.visible && this.batch) {
      this.resetSelections();
      this.loadStaticLists();
      this.loadOfferedSubjects();
    }
  }

  private resetSelections(): void {
    // Pre-fill from the Board Tab the admin opened this dialog from, if
    // any — see `defaultBoard`'s own docstring. Admin can still change it.
    this.selectedBoard.set(this.defaultBoard);
    this.selectedLevelId.set(null);
    this.selectedSubjectIdsToOffer.set([]);
    this.selectedAssignSubjectId.set(null);
    this.selectedTeacherId.set(null);
    this.catalogSubjects.set([]);
    this.assignedTeachers.set([]);
  }

  private loadStaticLists(): void {
    this.loadingLevels.set(true);
    this.academicsStaffService.getLevels().subscribe({
      next: (levels) => {
        this.levels.set(levels);
        this.loadingLevels.set(false);
      },
      error: () => this.loadingLevels.set(false),
    });

    this.loadingTeachers.set(true);
    this.userService.getUsersByRole(UserRole.Teacher).subscribe({
      next: (teachers) => {
        this.teachers.set(teachers);
        this.loadingTeachers.set(false);
      },
      error: () => this.loadingTeachers.set(false),
    });
  }

  private loadOfferedSubjects(): void {
    if (!this.batch) return;
    this.loadingOffered.set(true);
    this.academicsStaffService.getOfferedSubjects(this.batch.id).subscribe({
      next: (subjects) => {
        this.offeredSubjects.set(subjects);
        this.loadingOffered.set(false);
        this.syncOfferSelectionForLevel();
        // The subject just assigned/withdrawn may no longer be offered —
        // drop it from the Assign dropdown's selection if so.
        if (!this.offeredSubjectsForLevel().some((s) => s.subject_id === this.selectedAssignSubjectId())) {
          this.selectedAssignSubjectId.set(null);
          this.assignedTeachers.set([]);
        }
      },
      error: () => this.loadingOffered.set(false),
    });
  }

  onLevelChange(levelId: string | null): void {
    this.selectedLevelId.set(levelId);
    this.selectedAssignSubjectId.set(null);
    this.selectedSubjectIdsToOffer.set([]);
    this.assignedTeachers.set([]);

    if (!levelId) {
      this.catalogSubjects.set([]);
      return;
    }

    this.loadingCatalogSubjects.set(true);
    this.academicsStaffService.getSubjects(levelId).subscribe({
      next: (subjects) => {
        this.catalogSubjects.set(subjects);
        this.loadingCatalogSubjects.set(false);
        this.syncOfferSelectionForLevel();
      },
      error: () => this.loadingCatalogSubjects.set(false),
    });
  }

  /** Board dropdown handler — mirrors onLevelChange: changing the board
   *  context invalidates the "Assign Teacher" subject pick (offered under
   *  the OLD board may not be offered under the new one) and re-syncs the
   *  "Offer Subjects" multi-select against what's already offered under
   *  the newly selected board. */
  onBoardChange(board: Board | null): void {
    this.selectedBoard.set(board);
    this.selectedAssignSubjectId.set(null);
    this.assignedTeachers.set([]);
    this.syncOfferSelectionForLevel();
  }

  /** Pre-checks the "Offer Subjects" multi-select with whatever's
   *  already active for the currently selected level + board, so Save
   *  only ever submits the real diff instead of blindly re-offering
   *  everything. */
  private syncOfferSelectionForLevel(): void {
    const levelId = this.selectedLevelId();
    const board = this.selectedBoard();
    if (!levelId || !board) {
      this.selectedSubjectIdsToOffer.set([]);
      return;
    }
    const alreadyOffered = this.offeredSubjects()
      .filter((s) => s.level_id === levelId && s.board === board)
      .map((s) => s.subject_id);
    this.selectedSubjectIdsToOffer.set(alreadyOffered);
  }

  saveOfferedSubjects(): void {
    const levelId = this.selectedLevelId();
    const board = this.selectedBoard();
    if (!this.batch || !levelId || !board) return;

    const selected = new Set(this.selectedSubjectIdsToOffer());
    const currentlyOffered = new Set(
      this.offeredSubjects()
        .filter((s) => s.level_id === levelId && s.board === board)
        .map((s) => s.subject_id),
    );
    const toActivate = [...selected].filter((id) => !currentlyOffered.has(id));
    const toDeactivate = [...currentlyOffered].filter((id) => !selected.has(id));

    if (toActivate.length === 0 && toDeactivate.length === 0) {
      Swal.fire({ icon: 'info', title: 'Nothing to save', text: 'No changes to the offered subjects for this level and board.' });
      return;
    }

    const calls: Observable<OfferedSubject[]>[] = [];
    if (toActivate.length > 0) {
      calls.push(this.academicsStaffService.offerSubjects(this.batch.id, { subject_ids: toActivate, board, is_active: true }));
    }
    if (toDeactivate.length > 0) {
      calls.push(this.academicsStaffService.offerSubjects(this.batch.id, { subject_ids: toDeactivate, board, is_active: false }));
    }

    this.savingOffered.set(true);
    forkJoin(calls).subscribe({
      next: () => {
        this.savingOffered.set(false);
        Swal.fire({ icon: 'success', title: 'Offered subjects updated', confirmButtonColor: '#101d3c' });
        this.loadOfferedSubjects();
        this.saved.emit();
      },
      error: (err) => {
        this.savingOffered.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not update offered subjects',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  /** Subject dropdown handler in the "Assign Teacher" section — unlike the
   *  other selects here, this one also needs to load who's already
   *  assigned to the picked subject, so loadAssignedTeachers() is called
   *  as a side effect rather than leaving this a plain signal.set() in
   *  the template like the others. */
  onAssignSubjectChange(subjectId: string | null): void {
    this.selectedAssignSubjectId.set(subjectId);
    this.loadAssignedTeachers();
  }

  private loadAssignedTeachers(): void {
    const subjectId = this.selectedAssignSubjectId();
    if (!this.batch || !subjectId) {
      this.assignedTeachers.set([]);
      return;
    }
    this.loadingAssignedTeachers.set(true);
    this.academicsStaffService.getTeacherAssignments(subjectId, this.batch.id).subscribe({
      next: (assignments) => {
        this.assignedTeachers.set(assignments);
        this.loadingAssignedTeachers.set(false);
      },
      error: () => {
        this.assignedTeachers.set([]);
        this.loadingAssignedTeachers.set(false);
      },
    });
  }

  assignTeacher(): void {
    const subjectId = this.selectedAssignSubjectId();
    const teacherId = this.selectedTeacherId();
    if (!this.batch || !subjectId || !teacherId) return;

    this.assigningTeacher.set(true);
    this.academicsStaffService.assignTeacherToBatch(this.batch.id, { subject_id: subjectId, teacher_id: teacherId }).subscribe({
      next: () => {
        this.assigningTeacher.set(false);
        this.selectedTeacherId.set(null);
        Swal.fire({ icon: 'success', title: 'Teacher assigned', confirmButtonColor: '#101d3c' });
        // Refreshes the "Currently Assigned Teachers" list right below the
        // form so a second (third, etc.) teacher just added to the same
        // subject shows up immediately — confirming multi-teacher
        // assignment worked, without closing/reopening the dialog.
        this.loadAssignedTeachers();
        this.saved.emit();
      },
      error: (err) => {
        this.assigningTeacher.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not assign teacher',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }
}
