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
  AssessmentFull, RosterEntry, MarkUpsertPayload, TeacherAssignment, MarkEditRequestFull,
} from '../../../core/models/academics-staff.model';

/** Working row for the marks-entry grid: roster entry + editable marks_obtained.
 *  mark_id is null until marks are actually saved (i.e. before the row is
 *  locked) — Request Edit only makes sense once there's a real Mark row to
 *  reference. */
interface MarksEntryRow extends RosterEntry {
  marks_obtained: number | null;
  mark_id: string | null;
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
            this.roster.set(
              roster.map((r) => {
                const mark = marksByStudent.get(r.student_id);
                return { ...r, marks_obtained: mark?.marks_obtained ?? null, mark_id: mark?.id ?? null };
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