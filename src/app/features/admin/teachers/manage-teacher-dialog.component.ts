import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { TeacherService } from '../../../core/services/teacher.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { TeacherWorkloadSummary } from '../../../core/models/teacher.model';
import { Batch, OfferedSubject, Subject } from '../../../core/models/academic.model';

/**
 * One row of the "Current Assignments" table below — a display-joined
 * version of AcademicsStaffService.getTeacherAssignmentsFor()'s raw
 * TeacherAssignment (id/subject_id/batch_id only), enriched with
 * subject_name/batch_name resolved client-side against
 * `allSubjects`/`batches` (see `assignmentRows` below). Carries the real
 * assignment `id` — unlike TeacherWorkloadSummary.assignments — so
 * "Remove" has something to call DELETE .../assignments/{id} with.
 */
interface TeacherAssignmentRow {
  id: string;
  subject_id: string;
  subject_name: string;
  batch_id: string;
  batch_name: string;
}

/**
 * Admin/Coordinator: Manage Teacher.
 *
 * Opened via the "Manage" action on a Teachers row (AdminTeachersComponent)
 * — a dedicated read/write view of one teacher's workload, distinct from
 * the read-only Teacher Workload drawer (TeacherWorkloadDialogComponent)
 * that opens on a plain row click. Backs onto the teacher-scoped Workload
 * Management endpoints added in app/routers/teachers.py
 * (POST/DELETE /api/teachers/{teacher_id}/assignments[/{assignment_id}]),
 * not the generic /api/academic/teacher-assignments collection.
 *
 * Owns its own data loading, same split as ManageBatchDialogComponent:
 * the parent only owns `visible` and which `teacher` is selected.
 *
 * Assignment ids: TeacherWorkloadSummary.assignments (what the parent
 * already has loaded) is display-only and doesn't carry each row's real
 * assignment id, so it can't drive a Remove button on its own. This
 * dialog instead re-fetches via AcademicsStaffService.getTeacherAssignmentsFor()
 * — the same underlying teacher_subject_assignments rows — and de-dupes
 * by id to build `assignmentRows`. Subject/batch display names are
 * resolved client-side against the full subject catalog and batch list
 * (both loaded once per open) rather than adding a second backend shape
 * purpose-built for this table.
 *
 * Add Assignment form cascades Batch -> Subject, sourcing the Subject
 * dropdown from AcademicsStaffService.getOfferedSubjects(batchId) — same
 * "only offer what's actually offered on this batch" rule
 * ManageBatchDialogComponent's Assign-Teacher picker already follows —
 * so picking a subject here can't hit the backend's 400 ("no active
 * offering") in normal use. Subjects the teacher is already assigned to
 * on the selected batch are additionally filtered out client-side to
 * avoid a needless 409.
 */
@Component({
  selector: 'app-manage-teacher-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DialogModule, SelectModule, ButtonModule,
    TableModule, TagModule, ProgressSpinnerModule,
  ],
  templateUrl: './manage-teacher-dialog.component.html',
  styleUrl: './manage-teacher-dialog.component.scss',
})
export class ManageTeacherDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() teacher: TeacherWorkloadSummary | null = null;

  @Output() closed = new EventEmitter<void>();
  /** Emitted after any successful Assign or Remove — the parent's
   *  Teachers list (workload counts) should reload, same convention as
   *  ManageBatchDialogComponent's `saved`. */
  @Output() saved = new EventEmitter<void>();

  // --- Current Assignments (signals; refreshed after every write) ---
  private rawAssignmentIds = signal<{ id: string; subject_id: string; batch_id: string }[]>([]);
  loadingAssignments = signal(false);
  removingId = signal<string | null>(null);

  // --- Static lookups for display-joining the table above ---
  batches = signal<Batch[]>([]);
  loadingBatches = signal(false);
  allSubjects = signal<Subject[]>([]);

  /** De-duped, name-resolved rows for the "Current Assignments" table. */
  assignmentRows = computed<TeacherAssignmentRow[]>(() => {
    const subjectsById = new Map(this.allSubjects().map((s) => [s.id, s.name]));
    const batchesById = new Map(this.batches().map((b) => [b.id, b.name]));
    const seen = new Set<string>();
    const rows: TeacherAssignmentRow[] = [];
    for (const a of this.rawAssignmentIds()) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      rows.push({
        id: a.id,
        subject_id: a.subject_id,
        subject_name: subjectsById.get(a.subject_id) ?? 'Unknown subject',
        batch_id: a.batch_id,
        batch_name: batchesById.get(a.batch_id) ?? 'Unknown batch',
      });
    }
    return rows.sort(
      (a, b) => a.subject_name.localeCompare(b.subject_name) || a.batch_name.localeCompare(b.batch_name),
    );
  });

  // --- Add Assignment form ---
  selectedBatchId = signal<string | null>(null);
  offeredSubjects = signal<OfferedSubject[]>([]);
  loadingOfferedSubjects = signal(false);
  selectedSubjectId = signal<string | null>(null);
  assigning = signal(false);

  /** Subject ids the teacher is already actively assigned to on the
   *  currently-selected batch — kept out of `availableSubjects` below so
   *  re-picking one can't 409. */
  private alreadyAssignedSubjectIds = computed(() => {
    const batchId = this.selectedBatchId();
    if (!batchId) return new Set<string>();
    return new Set(this.assignmentRows().filter((r) => r.batch_id === batchId).map((r) => r.subject_id));
  });

  /** "Add Assignment" Subject dropdown source: actively offered subjects
   *  on the picked batch, minus ones already assigned to this teacher. */
  availableSubjects = computed(() => {
    const assigned = this.alreadyAssignedSubjectIds();
    return this.offeredSubjects().filter((s) => s.is_active && !assigned.has(s.subject_id));
  });

  constructor(
    private teacherService: TeacherService,
    private academicsStaffService: AcademicsStaffService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Reload everything fresh each time the dialog opens — covers both
    // "opened for the first time" and "closed, then reopened for a
    // different teacher" (teacher input can change while visible flips).
    if (changes['visible'] && this.visible && this.teacher) {
      this.resetSelections();
      this.loadStaticLists();
      this.loadAssignments();
    }
  }

  private resetSelections(): void {
    this.selectedBatchId.set(null);
    this.selectedSubjectId.set(null);
    this.offeredSubjects.set([]);
    this.rawAssignmentIds.set([]);
  }

  private loadStaticLists(): void {
    this.loadingBatches.set(true);
    this.academicsStaffService.getBatches().subscribe({
      next: (batches) => {
        this.batches.set(batches);
        this.loadingBatches.set(false);
      },
      error: () => this.loadingBatches.set(false),
    });

    // includeInactive: a teacher can already be assigned to a subject
    // that's since been deactivated — this must still resolve to a real
    // name in the table above, not "Unknown subject".
    this.academicsStaffService.getSubjects(undefined, true).subscribe({
      next: (subjects) => this.allSubjects.set(subjects),
      error: () => this.allSubjects.set([]),
    });
  }

  /** Refreshes the "Current Assignments" table off the live backend
   *  state — called on open and again after every successful Assign/
   *  Remove, so the signals-driven table never shows stale data. */
  private loadAssignments(): void {
    const teacher = this.teacher;
    if (!teacher) {
      this.rawAssignmentIds.set([]);
      return;
    }
    this.loadingAssignments.set(true);
    this.academicsStaffService.getTeacherAssignmentsFor(teacher.id).subscribe({
      next: (rows) => {
        this.rawAssignmentIds.set(rows.map((r) => ({
          id: r.id, subject_id: r.subject_id, batch_id: r.batch_id,
        })));
        this.loadingAssignments.set(false);
      },
      error: () => {
        this.rawAssignmentIds.set([]);
        this.loadingAssignments.set(false);
      },
    });
  }

  onBatchChange(batchId: string | null): void {
    this.selectedBatchId.set(batchId);
    this.selectedSubjectId.set(null);
    this.offeredSubjects.set([]);
    if (!batchId) return;

    this.loadingOfferedSubjects.set(true);
    this.academicsStaffService.getOfferedSubjects(batchId).subscribe({
      next: (subjects) => {
        this.offeredSubjects.set(subjects);
        this.loadingOfferedSubjects.set(false);
      },
      error: () => this.loadingOfferedSubjects.set(false),
    });
  }

  /** "Assign" — POST /api/teachers/{teacher_id}/assignments. On success,
   *  clears the Subject pick and reloads the assignments table (signals),
   *  so the new row appears immediately without closing the dialog. */
  assign(): void {
    const teacher = this.teacher;
    const batchId = this.selectedBatchId();
    const subjectId = this.selectedSubjectId();
    if (!teacher || !batchId || !subjectId) return;

    this.assigning.set(true);
    this.teacherService.assignToTeacher(teacher.id, { subject_id: subjectId, batch_id: batchId }).subscribe({
      next: () => {
        this.assigning.set(false);
        this.selectedSubjectId.set(null);
        Swal.fire({ icon: 'success', title: 'Assignment added', confirmButtonColor: '#101d3c' });
        this.loadAssignments();
        this.saved.emit();
      },
      error: (err) => {
        this.assigning.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not add assignment',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  /** "Remove" — DELETE /api/teachers/{teacher_id}/assignments/{assignment_id},
   *  with a confirmation prompt first since this is a destructive action
   *  (soft-deleted server-side, but immediately drops off every active
   *  workload view). Reloads the table on success. */
  remove(row: TeacherAssignmentRow): void {
    const teacher = this.teacher;
    if (!teacher) return;

    Swal.fire({
      icon: 'warning',
      title: 'Remove this assignment?',
      text: `${row.subject_name} — ${row.batch_name} will be removed from ${teacher.full_name}'s workload.`,
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#101d3c',
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.removingId.set(row.id);
      this.teacherService.removeAssignment(teacher.id, row.id).subscribe({
        next: () => {
          this.removingId.set(null);
          this.loadAssignments();
          this.saved.emit();
        },
        error: (err) => {
          this.removingId.set(null);
          Swal.fire({
            icon: 'error',
            title: 'Could not remove assignment',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
    });
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }
}
