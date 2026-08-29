
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
import { Batch, Level, Subject } from '../../../core/models/academic.model';
import { AssessmentFull, AuditLogEntry } from '../../../core/models/academics-staff.model';
import { loadOfferedPairs } from '../../../shared/utils/offered-pairs.util';
import {
  TeacherCascadingFilterComponent, TeacherFilterPair, TeacherFilterSubjectContext,
} from '../../../shared/ui/teacher-cascading-filter/teacher-cascading-filter.component';

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
 * Cascading selection flow, via the shared <app-teacher-cascading-filter>
 * widget (Board removed — same "never widen past an active offering"
 * cascade the Coordinator's Student Attendance and Admin's Teacher
 * Attendance screens use):
 *   Batch -> Level -> Subject -> Assessment/Test (created for that
 *   subject + batch) -> marks table for the selected assessment's
 *   roster.
 *
 * `allowedPairs` is sourced from every batch's ACTIVE offered-subjects
 * (loadOfferedPairs — one pair per batch+subject combination, no board
 * fan-out) rather than a teacher's own assignments, matching the
 * Coordinator-wide (not single-teacher-scoped) authorization this screen
 * needs.
 */
@Component({
  selector: 'app-coordinator-mark-override',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputTextModule, InputNumberModule, TextareaModule, TagModule,
    ProgressSpinnerModule, TooltipModule, TeacherCascadingFilterComponent,
  ],
  templateUrl: './coordinator-grades.component.html',
  styleUrl: './coordinator-grades.component.scss',
})
export class CoordinatorMarkOverrideComponent implements OnInit {
  // --- Cascade catalog data (coordinator-wide — every batch+subject with
  // an active offering, not scoped to one teacher's own assignments). ---
  batches = signal<Batch[]>([]);
  subjects = signal<Subject[]>([]);
  levels = signal<Level[]>([]);
  allowedPairs = signal<TeacherFilterPair[]>([]);
  pickerLoading = signal(true);
  pickerError = signal<string | null>(null);

  // Batch -> Level -> Subject stage. Chain stops at Subject
  // (periodsEnabled=false) — Assessment/Test is this screen's own extra
  // stage below Subject, not something the shared widget knows about.
  subjectContext = signal<TeacherFilterSubjectContext | null>(null);

  // --- Stage below Subject: Assessment / Test, filtered by Subject
  // (+ the Batch already selected via the cascade) ---
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
    this.pickerLoading.set(true);
    this.staffService.getSubjects().subscribe((s) => this.subjects.set(s));
    this.staffService.getLevels().subscribe((l) => this.levels.set(l));
    this.staffService.getBatches().subscribe({
      next: (batches) => {
        this.batches.set(batches);
        loadOfferedPairs(this.staffService, batches).subscribe({
          next: (pairs) => {
            this.allowedPairs.set(pairs);
            this.pickerLoading.set(false);
          },
          error: () => {
            this.pickerError.set('Could not load the batch/subject offerings right now.');
            this.pickerLoading.set(false);
          },
        });
      },
      error: () => {
        this.pickerError.set('Could not load batches right now.');
        this.pickerLoading.set(false);
      },
    });
  }

  // --- Cascade handler: fires whenever the Batch -> Level -> Subject
  // chain resolves (or stops resolving) — resets everything below it. ---

  onSubjectContextChange(ctx: TeacherFilterSubjectContext | null): void {
    this.subjectContext.set(ctx);
    this.resetAssessmentAndBelow();

    if (!ctx) return;
    this.assessmentsLoading.set(true);
    this.staffService.getAssessments(ctx.subject.id, ctx.batch.id).subscribe({
      next: (data) => {
        this.assessments.set(data);
        this.assessmentsLoading.set(false);
      },
      error: () => this.assessmentsLoading.set(false),
    });
    this.loadAuditHistory(ctx.subject.id, ctx.batch.id);
  }

  onAssessmentChange(assessmentId: string | null): void {
    this.selectedAssessmentId.set(assessmentId);
    this.roster.set([]);
    this.studentSearch.set('');

    const ctx = this.subjectContext();
    if (!assessmentId || !ctx) return;

    this.loadRosterAndMarks(assessmentId, ctx.subject.id, ctx.batch.id);
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

        const ctx = this.subjectContext();
        if (ctx) this.loadAuditHistory(ctx.subject.id, ctx.batch.id);
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
