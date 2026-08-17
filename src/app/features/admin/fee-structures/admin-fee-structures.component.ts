import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  students = signal<RegistryUser[]>([]);

  subjectFilter = signal<string | null>(null);

  // --- Add/Edit dialog ---
  dialogOpen = signal(false);
  dialogMode = signal<'create' | 'edit'>('create');
  editingId = signal<string | null>(null);
  formSubjectId = signal<string | null>(null);
  formStudentId = signal<string | null>(null); // null = subject-wide default
  formAmount = signal<number | null>(null);
  submitting = signal(false);

  // Computed signal for main filter dropdown
  subjectFilterOptions = computed<DropdownOption[]>(() => [
    { label: 'All subjects', value: null },
    ...this.subjects().map((s) => ({ label: s.name, value: s.id })),
  ]);

  // Computed signal for student dropdown in create dialog
  studentSelectOptions = computed<StudentOption[]>(() => [
    { full_name: 'All students (default)', id: null },
    ...this.students().map((s) => ({ full_name: s.full_name, id: s.id })),
  ]);

  constructor(
    private feesService: FeesService,
    private academicsStaffService: AcademicsStaffService,
    private registryService: RegistryService,
  ) {}

  ngOnInit(): void {
    this.loadStructures();
    this.academicsStaffService.getSubjects().subscribe({ next: (s) => this.subjects.set(s) });
    this.registryService.getUsers('student').subscribe({ next: (s) => this.students.set(s) });
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
    this.formSubjectId.set(this.subjectFilter());
    this.formStudentId.set(null);
    this.formAmount.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(fs: FeeStructure): void {
    this.dialogMode.set('edit');
    this.editingId.set(fs.id);
    this.formSubjectId.set(fs.subject_id);
    this.formStudentId.set(fs.student_id);
    this.formAmount.set(fs.amount);
    this.dialogOpen.set(true);
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