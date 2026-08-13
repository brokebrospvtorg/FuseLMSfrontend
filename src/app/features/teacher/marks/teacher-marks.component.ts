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
import { AuthService } from '../../../core/services/auth.service';
import { Subject, Batch } from '../../../core/models/academic.model';
import {
  AssessmentFull, RosterEntry, MarkUpsertPayload, TeacherAssignment,
} from '../../../core/models/academics-staff.model';

/** Working row for the marks-entry grid: roster entry + editable marks_obtained. */
interface MarksEntryRow extends RosterEntry {
  marks_obtained: number | null;
}

@Component({
  selector: 'app-teacher-marks',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputTextModule, InputNumberModule, TagModule, ProgressSpinnerModule, MessageModule,
  ],
  templateUrl: './teacher-marks.component.html',
  styleUrl: './teacher-marks.component.scss',
})
export class TeacherMarksComponent implements OnInit {
  // --- Subject/Batch picker, scoped to this teacher's own assignments ---
  assignments = signal<TeacherAssignment[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  pickerLoading = signal(true);

  selectedSubjectId = signal<string | null>(null);
  selectedBatchId = signal<string | null>(null);

  // Only show subject/batch combos this teacher is actually assigned to.
  assignmentOptions = computed(() => {
    const subjectsById = new Map(this.subjects().map((s) => [s.id, s]));
    const batchesById = new Map(this.batches().map((b) => [b.id, b]));
    return this.assignments()
      .map((a) => {
        const subj = subjectsById.get(a.subject_id);
        const batch = batchesById.get(a.batch_id);
        if (!subj || !batch) return null;
        return {
          label: `${subj.name} — ${batch.name}`,
          subject_id: a.subject_id,
          batch_id: a.batch_id,
        };
      })
      .filter((x): x is { label: string; subject_id: string; batch_id: string } => x !== null);
  });

  // --- Assessments for the selected subject+batch ---
  assessments = signal<AssessmentFull[]>([]);
  assessmentsLoading = signal(false);

  // --- Create-assessment dialog ---
  createDialogOpen = signal(false);
  newName = signal('');
  newMaxMarks = signal<number | null>(null);
  creating = signal(false);

  // Computed signal to safely resolve the selected combination in the template without evaluation inline
  selectedCombination = computed(() => {
    const currentSubject = this.selectedSubjectId();
    const currentBatch = this.selectedBatchId();
    
    if (!currentSubject || !currentBatch) return null;
    
    return this.assignmentOptions().find(o => 
      o.subject_id === currentSubject && o.batch_id === currentBatch
    ) || null;
  });

  // --- Marks-entry panel ---
  activeAssessment = signal<AssessmentFull | null>(null);
  roster = signal<MarksEntryRow[]>([]);
  rosterLoading = signal(false);
  savingMarks = signal(false);

  constructor(
    private staffService: AcademicsStaffService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.staffService.getMyTeacherAssignments().subscribe({
      next: (assignments) => {
        this.assignments.set(assignments);
        this.staffService.getSubjects().subscribe((s) => this.subjects.set(s));
        this.staffService.getBatches().subscribe((b) => {
          this.batches.set(b);
          this.pickerLoading.set(false);
        });
      },
      error: () => this.pickerLoading.set(false),
    });
  }

  onCombinationSelected(option: { subject_id: string; batch_id: string } | null): void {
    this.activeAssessment.set(null);
    this.roster.set([]);
    if (!option) {
      this.selectedSubjectId.set(null);
      this.selectedBatchId.set(null);
      this.assessments.set([]);
      return;
    }
    this.selectedSubjectId.set(option.subject_id);
    this.selectedBatchId.set(option.batch_id);
    this.loadAssessments();
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
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Publish rejected', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
    });
  }

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
            const marksByStudent = new Map(marks.map((m) => [m.student_id, m.marks_obtained]));
            this.roster.set(
              roster.map((r) => ({ ...r, marks_obtained: marksByStudent.get(r.student_id) ?? null })),
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
        Swal.fire({ icon: 'success', title: 'Marks saved', timer: 1400, showConfirmButton: false });
      },
      error: (err) => {
        this.savingMarks.set(false);
        Swal.fire({ icon: 'error', title: 'Could not save marks', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }
}