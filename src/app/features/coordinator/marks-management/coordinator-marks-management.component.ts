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

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { Subject, Batch, Level } from '../../../core/models/academic.model';
import { AssessmentFull, RosterEntry, MarkUpsertPayload } from '../../../core/models/academics-staff.model';

interface MarksEntryRow extends RosterEntry {
  marks_obtained: number | null;
  mark_id: string | null;
}

/**
 * Coordinator's direct create/edit/delete of assessments & marks —
 * the one genuinely missing piece from Sub-Sprint 2 (grade *override*
 * already existed in CoordinatorGradesComponent; this is the separate
 * "bypass the Teacher lock entirely" screen the spec calls for).
 *
 * Deliberately NOT scoped to "my assignments" like Teacher's screen —
 * Coordinator picks Level → Subject → Batch across the whole school,
 * same three-tier picker as CoordinatorGradesComponent. And unlike
 * Teacher's screen, there's no `locked` gate after first save: marks
 * stay directly editable, and there's no Request-Edit workflow here
 * because there's nothing to request — Coordinator just edits it.
 */
@Component({
  selector: 'app-coordinator-marks-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputTextModule, InputNumberModule, TagModule, ProgressSpinnerModule, MessageModule,
  ],
  templateUrl: './coordinator-marks-management.component.html',
  styleUrl: './coordinator-marks-management.component.scss',
})
export class CoordinatorMarksManagementComponent implements OnInit {
  levels = signal<Level[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  pickerLoading = signal(true);

  selectedLevelId = signal<string | null>(null);
  selectedSubjectId = signal<string | null>(null);
  selectedBatchId = signal<string | null>(null);

  levelOptions = computed(() => this.levels().map((l) => ({ label: l.name, value: l.id })));
  subjectOptions = computed(() => {
    const levelId = this.selectedLevelId();
    const pool = levelId ? this.subjects().filter((s) => s.level_id === levelId) : this.subjects();
    return pool.map((s) => ({ label: s.name, value: s.id }));
  });
  batchOptions = computed(() => this.batches().map((b) => ({ label: b.name, value: b.id })));

  // --- Assessments for the selected subject+batch ---
  assessments = signal<AssessmentFull[]>([]);
  assessmentsLoading = signal(false);

  // --- Create-assessment dialog ---
  createDialogOpen = signal(false);
  newName = signal('');
  newMaxMarks = signal<number | null>(null);
  creating = signal(false);

  // --- Edit-assessment dialog (new — Teacher's screen has no equivalent) ---
  editDialogOpen = signal(false);
  editingAssessment = signal<AssessmentFull | null>(null);
  editName = signal('');
  editMaxMarks = signal<number | null>(null);
  savingEdit = signal(false);

  // --- Marks-entry panel ---
  activeAssessment = signal<AssessmentFull | null>(null);
  roster = signal<MarksEntryRow[]>([]);
  rosterLoading = signal(false);
  savingMarks = signal(false);

  constructor(private staffService: AcademicsStaffService) {}

  ngOnInit(): void {
    this.staffService.getLevels().subscribe((levels) => {
      this.levels.set(levels);
      this.staffService.getSubjects().subscribe((s) => {
        this.subjects.set(s);
        this.staffService.getBatches().subscribe((b) => {
          this.batches.set(b);
          this.pickerLoading.set(false);
        });
      });
    });
  }

  onLevelChanged(levelId: string | null): void {
    this.selectedLevelId.set(levelId);
    const stillValid = this.subjects().some(
      (s) => s.id === this.selectedSubjectId() && (!levelId || s.level_id === levelId),
    );
    if (!stillValid) {
      this.selectedSubjectId.set(null);
      this.resetBelowPicker();
    }
  }

  onFiltersChanged(): void {
    this.resetBelowPicker();
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

  private resetBelowPicker(): void {
    this.assessments.set([]);
    this.activeAssessment.set(null);
    this.roster.set([]);
  }

  // --- Create ---
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
          this.onFiltersChanged();
        },
        error: (err) => {
          this.creating.set(false);
          Swal.fire({ icon: 'error', title: 'Could not create assessment', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
  }

  // --- Edit ---
  openEditDialog(assessment: AssessmentFull): void {
    this.editingAssessment.set(assessment);
    this.editName.set(assessment.name);
    this.editMaxMarks.set(assessment.max_marks);
    this.editDialogOpen.set(true);
  }

  submitEditAssessment(): void {
    const assessment = this.editingAssessment();
    const name = this.editName().trim();
    const maxMarks = this.editMaxMarks();

    if (!assessment || !name || maxMarks === null) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Fill in both fields before saving.' });
      return;
    }

    this.savingEdit.set(true);
    this.staffService.updateAssessment(assessment.id, { name, max_marks: maxMarks }).subscribe({
      next: () => {
        this.savingEdit.set(false);
        this.editDialogOpen.set(false);
        this.onFiltersChanged();
        // Re-select if it was the open one, so the marks grid's max-marks
        // validation and header reflect the new value immediately.
        if (this.activeAssessment()?.id === assessment.id) {
          this.selectAssessmentForMarks({ ...assessment, name, max_marks: maxMarks });
        }
        Swal.fire({ icon: 'success', title: 'Assessment updated', timer: 1400, showConfirmButton: false });
      },
      error: (err) => {
        this.savingEdit.set(false);
        Swal.fire({ icon: 'error', title: 'Could not update assessment', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  // --- Delete ---
  deleteAssessment(assessment: AssessmentFull): void {
    Swal.fire({
      icon: 'warning',
      title: `Delete "${assessment.name}"?`,
      text: 'This removes the assessment and every mark recorded under it, and recomputes affected students\u2019 grades. This cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.staffService.deleteAssessment(assessment.id).subscribe({
        next: () => {
          if (this.activeAssessment()?.id === assessment.id) {
            this.activeAssessment.set(null);
            this.roster.set([]);
          }
          this.onFiltersChanged();
          Swal.fire({ icon: 'success', title: 'Assessment deleted', timer: 1400, showConfirmButton: false });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Could not delete assessment', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
    });
  }

  publish(assessment: AssessmentFull): void {
    Swal.fire({
      icon: 'question',
      title: `Publish "${assessment.name}"?`,
      text: 'Marks become visible to students immediately.',
      showCancelButton: true,
      confirmButtonText: 'Publish',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.staffService.publishAssessment(assessment.id).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Published', timer: 1400, showConfirmButton: false });
          this.onFiltersChanged();
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Publish rejected', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
    });
  }

  // --- Marks entry (always editable — no lock, this IS the bypass) ---
  selectAssessmentForMarks(assessment: AssessmentFull): void {
    this.activeAssessment.set(assessment);
    const subjectId = this.selectedSubjectId();
    const batchId = this.selectedBatchId();
    if (!subjectId || !batchId) return;

    this.rosterLoading.set(true);
    this.staffService.getRoster(subjectId, batchId).subscribe({
      next: (roster) => {
        this.staffService.getMarks(assessment.id).subscribe({
          next: (marks) => {
            const marksByStudent = new Map(marks.map((m) => [m.student_id, m]));
            this.roster.set(
              roster.map((r) => {
                const mark = marksByStudent.get(r.student_id);
                return { ...r, marks_obtained: mark?.marks_obtained ?? null, mark_id: mark?.id ?? null };
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

  saveMarks(): void {
    const assessment = this.activeAssessment();
    if (!assessment) return;

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
        this.selectAssessmentForMarks(assessment); // refetch to pick up new mark_ids for delete
        Swal.fire({ icon: 'success', title: 'Marks saved', timer: 1400, showConfirmButton: false });
      },
      error: (err) => {
        this.savingMarks.set(false);
        Swal.fire({ icon: 'error', title: 'Could not save marks', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  deleteMark(row: MarksEntryRow): void {
    if (!row.mark_id) return;
    const assessment = this.activeAssessment();

    Swal.fire({
      icon: 'warning',
      title: `Delete ${row.full_name}'s mark?`,
      text: 'This recomputes their grade for this subject/batch. This cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (!result.isConfirmed || !row.mark_id) return;
      this.staffService.deleteMark(row.mark_id).subscribe({
        next: () => {
          if (assessment) this.selectAssessmentForMarks(assessment);
          Swal.fire({ icon: 'success', title: 'Mark deleted', timer: 1200, showConfirmButton: false });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Could not delete mark', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
    });
  }
}
