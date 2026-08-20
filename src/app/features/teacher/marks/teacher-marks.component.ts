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
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subject, Batch, Level } from '../../../core/models/academic.model';
import {
  AssessmentFull, RosterEntry, MarkUpsertPayload, TeacherAssignment, MarkEditRequestFull,
  GradeFull, AuditLogEntry,
} from '../../../core/models/academics-staff.model';
import { calculatePercentage, calculateGrade } from '../../../shared/utils/grading.util';
import {
  TeacherCascadingFilterComponent, TeacherFilterPair, TeacherFilterSubjectContext,
} from '../../../shared/ui/teacher-cascading-filter/teacher-cascading-filter.component';

/** Working row for the marks-entry grid: roster entry + editable marks_obtained.
 *  mark_id is null until marks are actually saved (i.e. before the row is
 *  locked) — Request Edit only makes sense once there's a real Mark row to
 *  reference.
 *
 *  Mark Override visibility (this update): is_overridden/overridden_by come
 *  straight off MarkFull. original_marks/override_reason are joined in
 *  client-side from GET /marks/audit-history — marks_obtained on the row
 *  itself is always the CURRENT (post-override, if any) value; original_marks
 *  is the pre-override value a Coordinator/Admin corrected away from, so a
 *  Teacher can see both instead of only the value that overwrote theirs. */
interface MarksEntryRow extends RosterEntry {
  marks_obtained: number | null;
  mark_id: string | null;
  is_overridden: boolean;
  overridden_by: string | null;
  original_marks: number | null;
  override_reason: string | null;
}

/** GradeFull plus a display name joined in client-side from the roster
 *  (GradeOut has no name field) — same enrichment CoordinatorGradesComponent
 *  uses for its own read of this endpoint. */
interface GradeRow extends GradeFull {
  student_name: string;
}

@Component({
  selector: 'app-teacher-marks',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputTextModule, InputNumberModule, TagModule, ProgressSpinnerModule,
    MessageModule, TooltipModule, TeacherCascadingFilterComponent,
  ],
  templateUrl: './teacher-marks.component.html',
  styleUrl: './teacher-marks.component.scss',
})
export class TeacherMarksComponent implements OnInit {
  // --- Batch -> Board -> Level -> Subject picker, scoped to this
  // teacher's own assignments. There's no Period stage for Marks entry
  // (marks are keyed by assessment, not by a day's time slot), so the
  // cascade terminates at Subject — see periodsEnabled below. ---
  assignments = signal<TeacherAssignment[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  levels = signal<Level[]>([]);
  pickerLoading = signal(true);

  selectedSubjectId = signal<string | null>(null);
  selectedBatchId = signal<string | null>(null);

  // Authorization guard for the cascading filter: only subject/batch/board
  // combinations this teacher is actually assigned to are ever offered.
  // `board` comes straight off the assignment (server-resolved from the
  // batch's actual active offering — see TeacherAssignment.board's
  // docstring) rather than being inferred client-side. A single
  // subject_id+batch_id pair can appear more than once here (fanned out
  // per active board by GET /academic/teacher-assignments) — that's
  // expected and is exactly what lets the Board dropdown show only the
  // boards this teacher is genuinely assigned under for this batch.
  allowedPairs = computed<TeacherFilterPair[]>(() =>
    this.assignments().map((a) => ({ subjectId: a.subject_id, batchId: a.batch_id, board: a.board })),
  );

  // --- Assessments for the selected subject+batch ---
  assessments = signal<AssessmentFull[]>([]);
  assessmentsLoading = signal(false);

  // --- Create-assessment dialog ---
  createDialogOpen = signal(false);
  newName = signal('');
  newMaxMarks = signal<number | null>(null);
  creating = signal(false);

  // --- Marks-entry panel ---
  activeAssessment = signal<AssessmentFull | null>(null);
  roster = signal<MarksEntryRow[]>([]);
  rosterLoading = signal(false);
  savingMarks = signal(false);

  // Sub-Sprint 4.2 — true once marks already exist for this assessment,
  // whether from a submission earlier in this session or a prior one.
  // Same pattern as the Attendance screen's lock: driven by what's
  // actually in the DB (re-fetched on select), not just local state, so
  // revisiting an already-graded assessment loads read-only. Unlocking
  // this later goes through the Sub-Sprint 5 "Request Edit" workflow —
  // this screen doesn't provide any other way to edit locked marks.
  locked = signal(false);

  // --- Sub-Sprint 5.1 — Request Edit dialog ---
  editRequestDialogOpen = signal(false);
  editRequestTarget = signal<MarksEntryRow | null>(null);
  editRequestNewMarks = signal<number | null>(null);
  editRequestReason = signal('');
  submittingEditRequest = signal(false);

  // --- Sub-Sprint 5.2 — status tracking ---
  myEditRequests = signal<MarkEditRequestFull[]>([]);
  editRequestsLoading = signal(true);

  // mark_ids with a request already pending, so the "Request Edit" button
  // can be disabled instead of letting the Teacher hit the 400 from a
  // duplicate submission.
  pendingRequestMarkIds = computed(() => new Set(
    this.myEditRequests().filter((r) => r.status === 'pending').map((r) => r.mark_id),
  ));

  // -------------------------------------------------------------------
  // Mark Override visibility (this update)
  // -------------------------------------------------------------------
  // Raw audit trail for the selected subject+batch — GET
  // /academics/marks/audit-history, now Teacher-readable (scoped
  // server-side to marks this Teacher uploaded). Re-fetched whenever the
  // subject/batch combo changes; joined into `roster` rows by mark_id so
  // the marks table can show a mark's pre-override value alongside its
  // current one.
  auditHistory = signal<AuditLogEntry[]>([]);
  auditHistoryByMarkId = computed(() => {
    const map = new Map<string, AuditLogEntry[]>();
    for (const entry of this.auditHistory()) {
      const list = map.get(entry.entity_id);
      if (list) list.push(entry);
      else map.set(entry.entity_id, [entry]);
    }
    // Oldest first, so [0] is the very first (pre-override) value on record.
    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  });

  // -------------------------------------------------------------------
  // Final Grade Display (this update)
  // -------------------------------------------------------------------
  // Computed percentage/letter grade per student for the selected
  // subject+batch — GET /academics/grades, independent of which single
  // assessment is open above. Reloaded on combo-select, after this
  // Teacher submits marks, and on demand via "Refresh Grades" so a
  // Coordinator override elsewhere (which triggers a server-side
  // recompute) shows up here without a full page reload.
  grades = signal<GradeRow[]>([]);
  gradesLoading = signal(false);

  constructor(
    private staffService: AcademicsStaffService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.staffService.getMyTeacherAssignments().subscribe({
      next: (assignments) => {
        this.assignments.set(assignments);
        this.staffService.getSubjects().subscribe((s) => this.subjects.set(s));
        this.staffService.getLevels().subscribe((l) => this.levels.set(l));
        this.staffService.getBatches().subscribe((b) => {
          this.batches.set(b);
          this.pickerLoading.set(false);
        });
      },
      error: () => this.pickerLoading.set(false),
    });
    this.loadMyEditRequests();
  }

  private loadMyEditRequests(): void {
    this.editRequestsLoading.set(true);
    this.staffService.getMyMarkEditRequests().subscribe({
      next: (requests) => {
        this.myEditRequests.set(requests);
        this.editRequestsLoading.set(false);
      },
      error: () => this.editRequestsLoading.set(false),
    });
  }

  onSubjectContextChanged(ctx: TeacherFilterSubjectContext | null): void {
    this.activeAssessment.set(null);
    this.roster.set([]);
    this.grades.set([]);
    this.auditHistory.set([]);
    if (!ctx) {
      this.selectedSubjectId.set(null);
      this.selectedBatchId.set(null);
      this.assessments.set([]);
      return;
    }
    this.selectedSubjectId.set(ctx.subject.id);
    this.selectedBatchId.set(ctx.batch.id);
    this.loadAssessments();
    this.loadAuditHistory();
    this.loadGrades();
  }

  private loadAssessments(): void {
    const subjectId = this.selectedSubjectId();
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
  }

  /** Subject+batch-scoped mark override history — powers the "original
   *  marks" figure next to an overridden row. Fetched once per combo
   *  select (not per-assessment) since the endpoint itself isn't
   *  assessment-scoped; selectAssessmentForMarks() below re-joins it into
   *  whichever roster is currently on screen. */
  private loadAuditHistory(): void {
    const subjectId = this.selectedSubjectId();
    const batchId = this.selectedBatchId();
    if (!subjectId || !batchId) {
      this.auditHistory.set([]);
      return;
    }
    this.staffService.getMarkAuditHistory(subjectId, batchId).subscribe({
      next: (entries) => this.auditHistory.set(entries),
      // Non-fatal — the marks table still works without override history,
      // it just can't show the pre-override figure.
      error: () => this.auditHistory.set([]),
    });
  }

  /** Final Grade Display: computed percentage/letter grade per student,
   *  independent of the per-assessment marks-entry panel below. */
  private loadGrades(): void {
    const subjectId = this.selectedSubjectId();
    const batchId = this.selectedBatchId();
    if (!subjectId || !batchId) {
      this.grades.set([]);
      return;
    }
    this.gradesLoading.set(true);
    this.staffService.getRoster(subjectId, batchId).subscribe({
      next: (roster) => {
        const namesByStudent = new Map(roster.map((r) => [r.student_id, r.full_name]));
        this.staffService.getGrades(subjectId, batchId).subscribe({
          next: (grades) => {
            this.grades.set(
              grades.map((g) => ({ ...g, student_name: namesByStudent.get(g.student_id) ?? g.student_id })),
            );
            this.gradesLoading.set(false);
          },
          error: () => this.gradesLoading.set(false),
        });
      },
      error: () => this.gradesLoading.set(false),
    });
  }

  /** Manual sync — lets a Teacher pull the latest computed grades on
   *  demand (e.g. right after being notified a Coordinator overrode a
   *  mark) without leaving and re-entering the subject/batch combo. */
  refreshGrades(): void {
    this.loadGrades();
  }

  openCreateDialog(): void {
    this.newName.set('');
    this.newMaxMarks.set(null);
    this.createDialogOpen.set(true);
  }

  submitCreateAssessment(): void {
    const subjectId = this.selectedSubjectId();
    const batchId = this.selectedBatchId();
    const name = this.newName().trim();
    const maxMarks = this.newMaxMarks();

    if (!subjectId || !batchId || !name || maxMarks === null) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Fill in all fields before saving.' });
      return;
    }

    this.creating.set(true);
    this.staffService
      .createAssessment({ subject_id: subjectId, batch_id: batchId, name, max_marks: maxMarks })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.createDialogOpen.set(false);
          this.loadAssessments();
        },
        error: (err) => {
          this.creating.set(false);
          Swal.fire({ icon: 'error', title: 'Could not create assessment', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
  }

  publish(assessment: AssessmentFull): void {
    Swal.fire({
      icon: 'question',
      title: `Publish "${assessment.name}"?`,
      text: 'Marks become visible to students immediately and can\'t be un-published.',
      showCancelButton: true,
      confirmButtonText: 'Publish',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.staffService.publishAssessment(assessment.id).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Published', timer: 1400, showConfirmButton: false });
          this.loadAssessments();
          this.loadGrades(); // publishing triggers a server-side recompute
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Publish rejected', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
    });
  }

  selectAssessmentForMarks(assessment: AssessmentFull): void {
    this.activeAssessment.set(assessment);
    this.locked.set(false);
    const subjectId = this.selectedSubjectId();
    const batchId = this.selectedBatchId();
    if (!subjectId || !batchId) return;

    this.rosterLoading.set(true);
    this.staffService.getRoster(subjectId, batchId).subscribe({
      next: (roster) => {
        this.staffService.getMarks(assessment.id).subscribe({
          next: (marks) => {
            const marksByStudent = new Map(marks.map((m) => [m.student_id, m]));
            const auditByMarkId = this.auditHistoryByMarkId();
            this.roster.set(
              roster.map((r) => {
                const mark = marksByStudent.get(r.student_id);
                // First recorded audit entry for this mark = the value
                // before the (first) override — i.e. what the Teacher
                // originally entered, distinct from the current
                // marks_obtained the override left behind.
                const history = mark ? auditByMarkId.get(mark.id) : undefined;
                const earliest = history?.[0];
                const latest = history?.[history.length - 1];
                const originalRaw = earliest?.old_value?.['marks_obtained'];
                const reasonRaw = latest?.new_value?.['reason'];
                return {
                  ...r,
                  marks_obtained: mark?.marks_obtained ?? null,
                  mark_id: mark?.id ?? null,
                  is_overridden: mark?.is_overridden ?? false,
                  overridden_by: mark?.overridden_by ?? null,
                  original_marks: originalRaw !== undefined ? Number(originalRaw) : null,
                  override_reason: typeof reasonRaw === 'string' ? reasonRaw : null,
                };
              }),
            );
            // Any marks already saved for this assessment → read-only.
            this.locked.set(marks.length > 0);
            this.rosterLoading.set(false);
          },
          error: () => this.rosterLoading.set(false),
        });
      },
      error: () => this.rosterLoading.set(false),
    });
  }

  // -------------------------------------------------------------------
  // Instant grading preview — recalculated on every change-detection pass
  // (i.e. on every keystroke in the marks input, via ngModelChange), so
  // the % and Grade columns update live as marks are entered, before the
  // row is ever saved. Handles a missing/zero max_marks or an
  // empty/invalid marks_obtained cleanly (returns null -> '—' in the
  // template) rather than showing NaN.
  // -------------------------------------------------------------------
  rowPercentage(row: MarksEntryRow): number | null {
    return calculatePercentage(row.marks_obtained, this.activeAssessment()?.max_marks ?? null);
  }

  rowGrade(row: MarksEntryRow): string | null {
    return calculateGrade(this.rowPercentage(row));
  }

  saveMarks(): void {
    const assessment = this.activeAssessment();
    if (!assessment || this.locked()) return;

    const entries: MarkUpsertPayload[] = this.roster()
      .filter((r) => r.marks_obtained !== null)
      .map((r) => ({ student_id: r.student_id, marks_obtained: r.marks_obtained as number }));

    if (entries.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Nothing to save', text: 'Enter at least one mark first.' });
      return;
    }

    this.savingMarks.set(true);
    this.staffService.upsertMarks(assessment.id, entries).subscribe({
      next: () => {
        this.savingMarks.set(false);
        this.locked.set(true); // lock immediately — don't wait for a refetch
        Swal.fire({
          icon: 'success',
          title: 'Marks saved',
          text: 'Marks are now locked. To change them later, use the Request Edit button on that row.',
          timer: 2400,
          showConfirmButton: false,
        });
        this.loadGrades(); // Final Grade Display: keep the computed-grades panel in sync
      },
      error: (err) => {
        this.savingMarks.set(false);
        Swal.fire({ icon: 'error', title: 'Could not save marks', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  // -------------------------------------------------------------------
  // Sub-Sprint 5.1 — Request Edit (on a locked marks row)
  // -------------------------------------------------------------------
  openEditRequestDialog(row: MarksEntryRow): void {
    if (!row.mark_id) return;
    this.editRequestTarget.set(row);
    this.editRequestNewMarks.set(row.marks_obtained);
    this.editRequestReason.set('');
    this.editRequestDialogOpen.set(true);
  }

  submitEditRequest(): void {
    const target = this.editRequestTarget();
    const newMarks = this.editRequestNewMarks();
    const reason = this.editRequestReason().trim();
    const maxMarks = this.activeAssessment()?.max_marks;

    if (!target?.mark_id || newMarks === null) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Enter the new marks value.' });
      return;
    }
    if (!reason) {
      Swal.fire({ icon: 'warning', title: 'Reason required', text: 'Add a short justification for the Coordinator.' });
      return;
    }
    if (maxMarks !== undefined && newMarks > maxMarks) {
      Swal.fire({ icon: 'warning', title: 'Too high', text: `Marks cannot exceed ${maxMarks}.` });
      return;
    }

    this.submittingEditRequest.set(true);
    this.staffService
      .requestMarkEdit(target.mark_id, { requested_change: { marks_obtained: newMarks }, reason })
      .subscribe({
        next: () => {
          this.submittingEditRequest.set(false);
          this.editRequestDialogOpen.set(false);
          this.loadMyEditRequests();
          Swal.fire({
            icon: 'success',
            title: 'Request sent',
            text: 'Your Coordinator will review this edit request.',
            timer: 2000,
            showConfirmButton: false,
          });
        },
        error: (err) => {
          this.submittingEditRequest.set(false);
          Swal.fire({ icon: 'error', title: 'Could not send request', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
  }
}
