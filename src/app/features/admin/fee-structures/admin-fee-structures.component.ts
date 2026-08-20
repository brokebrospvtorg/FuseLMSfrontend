import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { FeesService } from '../../../core/services/fees.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { RegistryService } from '../../../core/services/registry.service';
import { FeeStructure } from '../../../core/models/fees.model';
import { Subject } from '../../../core/models/academic.model';
import { RegistryUser } from '../../../core/models/registry.model';
import { CascadingSelect } from '../../../shared/utils/cascading-select';

interface DropdownOption {
  label: string;
  value: string | null;
}

interface StudentOption {
  full_name: string;
  id: string | null;
}

@Component({
  selector: 'app-admin-fee-structures',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule,
    InputNumberModule, ButtonModule, DialogModule, ProgressSpinnerModule,
  ],
  templateUrl: './admin-fee-structures.component.html',
  styleUrl: './admin-fee-structures.component.scss',
})
export class AdminFeeStructuresComponent implements OnInit {
  structures = signal<FeeStructure[]>([]);
  loading = signal(true);
  subjects = signal<Subject[]>([]);

  subjectFilter = signal<string | null>(null);

  // --- Add/Edit dialog ---
  dialogOpen = signal(false);
  dialogMode = signal<'create' | 'edit'>('create');
  editingId = signal<string | null>(null);
  formSubjectId = signal<string | null>(null);
  formStudentId = signal<string | null>(null); // null = subject-wide default
  formAmount = signal<number | null>(null);
  submitting = signal(false);

  // Full student directory, kept around only to resolve a student_id ->
  // full_name for options the cascade below returns (which come from the
  // enrollments endpoint and don't carry a name).
  private allStudents = signal<RegistryUser[]>([]);

  // Cascading: the Student dropdown in the dialog only shows students
  // actually enrolled in whichever Subject is currently picked in the
  // dialog's own Subject field (formSubjectId) — previously this listed
  // every student in the system regardless of subject, so you could set a
  // subject-specific fee for a student who isn't even taking that subject.
  readonly cascadingStudents = new CascadingSelect<string, RegistryUser>((subjectId) => {
    const byId = new Map(this.allStudents().map((s) => [s.id, s]));
    return this.academicsStaffService.getEnrollmentsBySubject(subjectId).pipe(
      map((enrollments) => {
        const seen = new Set<string>();
        const result: RegistryUser[] = [];
        for (const e of enrollments) {
          if (seen.has(e.student_id)) continue;
          const student = byId.get(e.student_id);
          if (student) {
            seen.add(e.student_id);
            result.push(student);
          }
        }
        return result.sort((a, b) => a.full_name.localeCompare(b.full_name));
      }),
    );
  });

  // Computed signal for main filter dropdown
  subjectFilterOptions = computed<DropdownOption[]>(() => [
    { label: 'All subjects', value: null },
    ...this.subjects().map((s) => ({ label: s.name, value: s.id })),
  ]);

  // Computed signal for the dialog's student dropdown — "All students
  // (default)" is always available (a subject-wide default fee doesn't
  // need one particular student), the rest come from the cascade above.
  studentSelectOptions = computed<StudentOption[]>(() => [
    { full_name: 'All students (default)', id: null },
    ...this.cascadingStudents.options().map((s) => ({ full_name: s.full_name, id: s.id })),
  ]);

  constructor(
    private feesService: FeesService,
    private academicsStaffService: AcademicsStaffService,
    private registryService: RegistryService,
  ) {}

  ngOnInit(): void {
    this.loadStructures();
    this.academicsStaffService.getSubjects().subscribe({ next: (s) => this.subjects.set(s) });
    this.registryService.getUsers('student').subscribe({ next: (s) => this.allStudents.set(s) });
  }

  loadStructures(): void {
    this.loading.set(true);
    this.feesService.getFeeStructures(this.subjectFilter() ?? undefined).subscribe({
      next: (data) => {
        this.structures.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.formStudentId.set(null);
    this.formAmount.set(null);
    this.dialogOpen.set(true);

    // Prefill the dialog's subject from whichever the list is currently
    // filtered to, and cascade the student list to match.
    const prefillSubjectId = this.subjectFilter();
    this.formSubjectId.set(prefillSubjectId);
    this.cascadingStudents.loadFor(prefillSubjectId);
  }

  openEditDialog(fs: FeeStructure): void {
    this.dialogMode.set('edit');
    this.editingId.set(fs.id);
    this.formSubjectId.set(fs.subject_id);
    this.formStudentId.set(fs.student_id);
    this.formAmount.set(fs.amount);
    this.dialogOpen.set(true);
    // Note: the Student picker isn't shown in edit mode at all (subject
    // and scope are locked, only the amount is editable — see the
    // template), so there's nothing to cascade-load here.
  }

  onFormSubjectChanged(subjectId: string | null): void {
    this.formSubjectId.set(subjectId);
    // The child's own selection always resets on a parent change — a
    // student who was valid for the old subject may not be enrolled in
    // the new one.
    this.formStudentId.set(null);
    this.cascadingStudents.loadFor(subjectId);
  }

  submit(): void {
    const amount = this.formAmount();
    if (amount === null || amount <= 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid amount', text: 'Enter an amount greater than zero.' });
      return;
    }

    this.submitting.set(true);

    if (this.dialogMode() === 'create') {
      const subjectId = this.formSubjectId();
      if (!subjectId) {
        this.submitting.set(false);
        Swal.fire({ icon: 'warning', title: 'Missing subject', text: 'Pick a subject before saving.' });
        return;
      }
      this.feesService
        .createFeeStructure({ subject_id: subjectId, student_id: this.formStudentId(), amount })
        .subscribe({
          next: () => this.onSaved(),
          error: (err) => this.onSaveError(err),
        });
    } else {
      const id = this.editingId();
      if (!id) return;
      this.feesService.updateFeeStructureAmount(id, amount).subscribe({
        next: () => this.onSaved(),
        error: (err) => this.onSaveError(err),
      });
    }
  }

  private onSaved(): void {
    this.submitting.set(false);
    this.dialogOpen.set(false);
    Swal.fire({ icon: 'success', title: 'Saved', confirmButtonColor: '#101d3c' });
    this.loadStructures();
  }

  private onSaveError(err: any): void {
    this.submitting.set(false);
    Swal.fire({ icon: 'error', title: 'Could not save', text: err?.error?.detail ?? 'Please try again.' });
  }

  deleteStructure(fs: FeeStructure): void {
    const scope = fs.student_name ? `for ${fs.student_name}` : 'as the subject default';
    Swal.fire({
      icon: 'warning',
      title: `Remove this fee?`,
      text: `${fs.subject_name} — ${scope}`,
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.feesService.deleteFeeStructure(fs.id).subscribe({
        next: () => this.loadStructures(),
        error: (err) => Swal.fire({ icon: 'error', title: 'Could not remove', text: err?.error?.detail ?? 'Please try again.' }),
      });
    });
  }
}