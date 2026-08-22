
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { Batch, BatchSubject } from '../../../core/models/academic.model';
import { AssessmentFull, AuditLogEntry } from '../../../core/models/academics-staff.model';
import { Board } from '../../../core/models/enums';
import { BOARD_OPTIONS } from '../../../shared/utils/board-options.util';

/** One roster row joined with its current Mark (if any) for the selected
 *  assessment. `draftMarks` is the value bound to the inline editor;
 *  `marks_obtained` stays untouched until a save actually succeeds, so a
 *  half-typed edit can always be discarded via resetDraft(). */
interface MarkOverrideRow {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  mark_id: string | null;
  marks_obtained: number | null;
  draftMarks: number | null;
  is_overridden: boolean;
  overridden_by: string | null;
}

/**
 * Coordinator "Mark Override" — corrects one student's score on one
 * already-recorded assessment Mark (schema_update_18's Mark Override
 * refactor). Replaces the old subject-level Grade override screen:
 * Grade is now a purely computed rollup (see GradeFull) and can never be
 * set directly, so overriding happens one Mark at a time here instead;
 * the backend recomputes the student's pooled percentage/letter grade
 * automatically after every override.
 *
 * Cascading selection flow, each stage narrowing the next and clearing
 * everything downstream on change:
 *   Batch -> Board (offered in that batch) -> Level (offered in that
 *   batch, under that board) -> Subject (offered at that level, in that
 *   batch, under that board) -> Assessment/Test (created for that
 *   subject + batch) -> marks table for the selected assessment's
 *   roster.
 *
 * Board is a mandatory stage, not cosmetic: `offeredSubjects` holds one
 * row per (level, subject, board) offering (schema_update_15 — the same
 * subject can be offered more than once for a batch, once per board), so
 * skipping straight from Batch to Level the way this screen used to
 * would silently collapse multiple boards' offerings of the same
 * subject into a single ambiguous Level/Subject option.
 */
@Component({
  selector: 'app-coordinator-mark-override',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputTextModule, InputNumberModule, TextareaModule, TagModule,
    ProgressSpinnerModule, TooltipModule,
  ],
  templateUrl: './coordinator-grades.component.html',
  styleUrl: './coordinator-grades.component.scss',
})
export class CoordinatorMarkOverrideComponent implements OnInit {
  // --- Stage 1: Batch ---
  batches = signal<Batch[]>([]);
  batchesLoading = signal(true);
  selectedBatchId = signal<string | null>(null);
  // Only batches the Admin/Coordinator has left open for work (batch.is_active
  // — a stored toggle, "is this batch open for admin/coordinator work",
  // independent of is_current) should be pickable for a marks correction.
  // Previously showed every batch ever generated, including years-ahead
  // template batches nothing has been offered on yet and old closed ones.
  batchOptions = computed(() =>
    this.batches()
      .filter((b) => b.is_active)
      .map((b) => ({ label: b.name, value: b.id })),
  );

  // --- Stage 2, 3 & 4 source data: everything offered in the selected
  // batch, one row per (level, subject, board) offering — same shape the
  // Admin "offered subjects" pickers already use, so Board + Level +
  // Subject all derive from a single request instead of three separate
  // endpoints. ---
  offeredSubjects = signal<BatchSubject[]>([]);
  offeredSubjectsLoading = signal(false);

  // --- Stage 2: Board (depends on Batch) — options are only the boards
  // actually offered in the selected batch (derived from offeredSubjects
  // itself), not the full static BOARD_OPTIONS list, so a board with
  // nothing offered under it in this batch never becomes a dead end. ---
  selectedBoard = signal<Board | null>(null);
  boardOptions = computed(() => {
    const boardsPresent = new Set<Board>(this.offeredSubjects().map((s) => s.board));
    return BOARD_OPTIONS.filter((opt) => boardsPresent.has(opt.value));
  });

  // --- Stage 3: Level (depends on Batch + Board) ---
  selectedLevelId = signal<string | null>(null);
  levelOptions = computed(() => {
    const board = this.selectedBoard();
    if (!board) return [];
    const seen = new Map<string, string>();
    for (const s of this.offeredSubjects()) {
      if (s.board !== board) continue;
      if (!seen.has(s.level_id)) seen.set(s.level_id, s.level_name);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ label, value }));
  });

  // --- Stage 4: Subject (depends on Batch + Board + Level) ---
  selectedSubjectId = signal<string | null>(null);
  subjectOptions = computed(() => {
    const board = this.selectedBoard();
    const levelId = this.selectedLevelId();
    if (!board || !levelId) return [];
    return this.offeredSubjects()
      .filter((s) => s.board === board && s.level_id === levelId)
      .map((s) => ({ label: s.subject_name, value: s.subject_id }));
  });

  // --- Stage 5: Assessment / Test, filtered by Subject (+ the Batch
  // already selected in stage 1) ---
  assessments = signal<AssessmentFull[]>([]);
  assessmentsLoading = signal(false);
  selectedAssessmentId = signal<string | null>(null);
  assessmentOptions = computed(() =>
    this.assessments().map((a) => ({ label: `${a.name} (/ ${a.max_marks})`, value: a.id })),
  );
  activeAssessment = computed(
    () => this.assessments().find((a) => a.id === this.selectedAssessmentId()) ?? null,
  );

  // --- Marks table for the selected assessment ---
  roster = signal<MarkOverrideRow[]>([]);
  rosterLoading = signal(false);
  studentSearch = signal('');
  visibleRoster = computed(() => {
    const term = this.studentSearch().trim().toLowerCase();
    if (!term) return this.roster();
    return this.roster().filter(
      (r) => r.full_name.toLowerCase().includes(term) || (r.roll_number ?? '').toLowerCase().includes(term),
    );
  });

  // --- Override dialog (reason is mandatory — enforced by the backend too) ---
  overrideDialogOpen = signal(false);
  overridingRow = signal<MarkOverrideRow | null>(null);
  overrideReason = signal('');
  submittingOverride = signal(false);
  canSubmitOverride = computed(() => !!this.overrideReason().trim());

  // --- Recent override history, scoped to the selected Subject + Batch ---
  auditHistory = signal<AuditLogEntry[]>([]);
  auditLoading = signal(false);

  constructor(private staffService: AcademicsStaffService) {}

  ngOnInit(): void {
    this.batchesLoading.set(true);
    this.staffService.getBatches().subscribe({
      next: (batches) => {
        this.batches.set(batches);
        this.batchesLoading.set(false);
      },
      error: () => this.batchesLoading.set(false),
    });
  }

  // --- Cascade handlers: each stage resets every stage downstream of it ---

  onBatchChange(batchId: string | null): void {
    this.selectedBatchId.set(batchId);
    this.offeredSubjects.set([]);
    this.resetBoardAndBelow();

    if (!batchId) return;
    this.offeredSubjectsLoading.set(true);
    this.staffService.getOfferedSubjects(batchId).subscribe({
      next: (offered) => {
        this.offeredSubjects.set(offered);
        this.offeredSubjectsLoading.set(false);
      },
      error: () => this.offeredSubjectsLoading.set(false),
    });
  }

  onBoardChange(board: Board | null): void {
    this.selectedBoard.set(board);
    this.resetLevelAndBelow();
  }

  onLevelChange(levelId: string | null): void {
    this.selectedLevelId.set(levelId);
    this.resetSubjectAndBelow();
  }

  onSubjectChange(subjectId: string | null): void {
    this.selectedSubjectId.set(subjectId);
    this.resetAssessmentAndBelow();

    const batchId = this.selectedBatchId();
    if (!subjectId || !batchId) return;

    this.assessmentsLoading.set(true);
    this.staffService.getAssessments(subjectId, batchId).subscribe({
      next: (data) => {
        this.assessments.set(data);
        this.assessmentsLoading.set(false);
      },
      error: () => this.assessmentsLoading.set(false),
    });
    this.loadAuditHistory(subjectId, batchId);
  }

  onAssessmentChange(assessmentId: string | null): void {
    this.selectedAssessmentId.set(assessmentId);
    this.roster.set([]);
    this.studentSearch.set('');

    const subjectId = this.selectedSubjectId();
    const batchId = this.selectedBatchId();
    if (!assessmentId || !subjectId || !batchId) return;

    this.loadRosterAndMarks(assessmentId, subjectId, batchId);
  }

  private resetBoardAndBelow(): void {
    this.selectedBoard.set(null);
    this.resetLevelAndBelow();
  }

  private resetLevelAndBelow(): void {
    this.selectedLevelId.set(null);
    this.resetSubjectAndBelow();
  }

  private resetSubjectAndBelow(): void {
    this.selectedSubjectId.set(null);
    this.resetAssessmentAndBelow();
  }

  private resetAssessmentAndBelow(): void {
    this.assessments.set([]);
    this.selectedAssessmentId.set(null);
    this.roster.set([]);
    this.studentSearch.set('');
    this.auditHistory.set([]);
  }

  // --- Marks table ---

  private loadRosterAndMarks(assessmentId: string, subjectId: string, batchId: string): void {
    this.rosterLoading.set(true);
    this.staffService.getRoster(subjectId, batchId).subscribe({
      next: (roster) => {
        this.staffService.getMarks(assessmentId).subscribe({
          next: (marks) => {
            const marksByStudent = new Map(marks.map((m) => [m.student_id, m]));
            this.roster.set(
              roster.map((r) => {
                const mark = marksByStudent.get(r.student_id);
                return {
                  student_id: r.student_id,
                  full_name: r.full_name,
                  roll_number: r.roll_number,
                  mark_id: mark?.id ?? null,
                  marks_obtained: mark?.marks_obtained ?? null,
                  draftMarks: mark?.marks_obtained ?? null,
                  is_overridden: mark?.is_overridden ?? false,
                  overridden_by: mark?.overridden_by ?? null,
                };
              }),
            );
            this.rosterLoading.set(false);
          },
          error: () => this.rosterLoading.set(false),
        });
      },
      error: () => this.rosterLoading.set(false),
    });
  }

  /** A row is eligible to save once its draft differs from the last saved
   *  value — and only if a Mark already exists (mark-override corrects an
   *  existing Mark; it can't create one — that's the Teacher's upload/
   *  upsert path, or the Coordinator's separate Marks & Assessments screen). */
  isDirty(row: MarkOverrideRow): boolean {
    return row.mark_id !== null && row.draftMarks !== null && row.draftMarks !== row.marks_obtained;
  }

  resetDraft(row: MarkOverrideRow): void {
    row.draftMarks = row.marks_obtained;
  }

  openOverrideDialog(row: MarkOverrideRow): void {
    if (!this.isDirty(row)) return;
    this.overridingRow.set(row);
    this.overrideReason.set('');
    this.overrideDialogOpen.set(true);
  }

  submitOverride(): void {
    const row = this.overridingRow();
    const reason = this.overrideReason().trim();
    const assessment = this.activeAssessment();

    if (!row || !row.mark_id || row.draftMarks === null || !reason) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Enter a reason before confirming.' });
      return;
    }
    if (assessment && row.draftMarks > assessment.max_marks) {
      Swal.fire({
        icon: 'warning',
        title: 'Out of range',
        text: `Marks cannot exceed ${assessment.max_marks} for this assessment.`,
      });
      return;
    }

    this.submittingOverride.set(true);
    this.staffService.markOverride(row.mark_id, { marks_obtained: row.draftMarks, override_reason: reason }).subscribe({
      next: (updated) => {
        this.submittingOverride.set(false);
        this.overrideDialogOpen.set(false);
        row.marks_obtained = updated.marks_obtained;
        row.draftMarks = updated.marks_obtained;
        row.is_overridden = updated.is_overridden;
        row.overridden_by = updated.overridden_by;

        Swal.fire({
          icon: 'success',
          title: 'Mark overridden',
          text: 'The change was logged and the original teacher and student were notified.',
          timer: 2200,
          showConfirmButton: false,
        });

        const subjectId = this.selectedSubjectId();
        const batchId = this.selectedBatchId();
        if (subjectId && batchId) this.loadAuditHistory(subjectId, batchId);
      },
      error: (err) => {
        this.submittingOverride.set(false);
        Swal.fire({ icon: 'error', title: 'Could not override mark', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  private loadAuditHistory(subjectId: string, batchId: string): void {
    this.auditLoading.set(true);
    this.staffService.getMarkAuditHistory(subjectId, batchId).subscribe({
      next: (entries) => {
        this.auditHistory.set(entries);
        this.auditLoading.set(false);
      },
      error: () => this.auditLoading.set(false),
    });
  }
}