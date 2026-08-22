import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { Subject } from '../../../core/models/academic.model';
import { AddSubjectDialogComponent } from './add-subject-dialog.component';

/**
 * DEDICATED ADMIN SUBJECTS MODULE.
 *
 * Distinct from AdminSubjectCatalogComponent (the read-only-ish catalog
 * tab embedded inside Academics Management, which only offers list + Add
 * Subject): this is its own sidebar entry (`/admin/subjects`) and adds the
 * three admin-only mutations the task calls for — edit name/code,
 * activate/deactivate, and dependency-checked delete — backed by
 * app/routers/subjects.py's PUT/PATCH/DELETE endpoints. The Add Subject
 * flow itself is NOT duplicated here; it reuses AddSubjectDialogComponent
 * as-is, since create already fully works via academic.py's POST.
 *
 * Same signals + FormsModule pattern as every other admin screen in this
 * codebase (AddSubjectDialogComponent, AdminBatchesComponent, ...), and
 * the same Swal confirm-before-destructive-action pattern as
 * AdminRegistryComponent.deleteUser.
 */
@Component({
  selector: 'app-admin-subjects',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, ButtonModule, TagModule,
    DialogModule, InputTextModule, ProgressSpinnerModule, MessageModule,
    AddSubjectDialogComponent,
  ],
  templateUrl: './admin-subjects.component.html',
  styleUrl: './admin-subjects.component.scss',
})
export class AdminSubjectsComponent implements OnInit {
  subjects = signal<Subject[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // --- Add Subject (delegates entirely to the existing dialog) ---
  addDialogVisible = signal(false);

  // --- Edit Subject (name/code only — see SubjectUpdate's docstring) ---
  editDialogVisible = signal(false);
  editingSubject = signal<Subject | null>(null);
  editName = signal('');
  editCode = signal('');
  editSaving = signal(false);

  // Per-row in-flight state for the Activate/Deactivate toggle, keyed by
  // subject id, so only the row actually being toggled shows a spinner —
  // not the whole table.
  statusUpdatingId = signal<string | null>(null);

  constructor(private academicsStaffService: AcademicsStaffService) {}

  ngOnInit(): void {
    this.loadSubjects();
  }

  private loadSubjects(): void {
    this.loading.set(true);
    this.error.set(null);
    this.academicsStaffService.getSubjects(undefined, true).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the subject catalog. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // --- Add Subject ---
  openAddSubject(): void {
    this.addDialogVisible.set(true);
  }

  onAddDialogClosed(): void {
    this.addDialogVisible.set(false);
  }

  onSubjectAdded(): void {
    this.loadSubjects();
  }

  // --- Edit Subject (name/code) ---
  openEditSubject(subject: Subject): void {
    this.editingSubject.set(subject);
    this.editName.set(subject.name);
    this.editCode.set(subject.code);
    this.editDialogVisible.set(true);
  }

  closeEditDialog(): void {
    this.editDialogVisible.set(false);
    this.editingSubject.set(null);
  }

  onEditDialogVisibleChange(visible: boolean): void {
    if (!visible) this.closeEditDialog();
  }

  canSaveEdit(): boolean {
    return this.editName().trim().length > 0 && this.editCode().trim().length > 0 && !this.editSaving();
  }

  saveEdit(): void {
    const subject = this.editingSubject();
    if (!subject || !this.canSaveEdit()) return;

    this.editSaving.set(true);
    this.academicsStaffService
      .updateSubject(subject.id, { name: this.editName().trim(), code: this.editCode().trim() })
      .subscribe({
        next: (updated) => {
          this.editSaving.set(false);
          this.subjects.set(this.subjects().map((s) => (s.id === updated.id ? updated : s)));
          this.closeEditDialog();
          Swal.fire({
            icon: 'success',
            title: 'Subject Updated',
            text: `${updated.name} (${updated.code}) has been saved.`,
            confirmButtonColor: '#101d3c',
            timer: 2000,
            timerProgressBar: true,
          });
        },
        error: (err) => {
          this.editSaving.set(false);
          // Backend returns 400 on a case-insensitive name/code collision
          // with another subject (see update_subject in routers/subjects.py).
          if (err?.status === 400) {
            Swal.fire({
              icon: 'warning',
              title: 'Subject Already Exists!',
              text: err?.error?.detail ?? 'Another subject with this name or code already exists in the catalog.',
            });
            return;
          }
          Swal.fire({
            icon: 'error',
            title: 'Could not update subject',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
  }

  // --- Activate / Deactivate ---
  toggleStatus(subject: Subject): void {
    const nextActive = !subject.is_active;
    this.statusUpdatingId.set(subject.id);
    this.academicsStaffService.setSubjectStatus(subject.id, { is_active: nextActive }).subscribe({
      next: (updated) => {
        this.statusUpdatingId.set(null);
        this.subjects.set(this.subjects().map((s) => (s.id === updated.id ? updated : s)));
      },
      error: (err) => {
        this.statusUpdatingId.set(null);
        Swal.fire({
          icon: 'error',
          title: nextActive ? 'Could not activate subject' : 'Could not deactivate subject',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  // --- Delete (dependency-checked) ---
  deleteSubject(subject: Subject): void {
    Swal.fire({
      icon: 'warning',
      title: `Delete ${subject.name}?`,
      text: 'This removes the subject from the catalog. If it\'s still referenced by any batch offering, enrollment, teacher assignment, or subject request, it can\'t be deleted — deactivate it instead.',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      confirmButtonColor: '#c00000',
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.academicsStaffService.deleteSubject(subject.id).subscribe({
        next: () => {
          this.subjects.set(this.subjects().filter((s) => s.id !== subject.id));
          Swal.fire({
            icon: 'success',
            title: 'Subject Deleted',
            confirmButtonColor: '#101d3c',
            timer: 1800,
            timerProgressBar: true,
          });
        },
        error: (err) => {
          // 409 = dependency check failed (routers/subjects.py:delete_subject) —
          // the backend's detail already names what's blocking it and
          // suggests Deactivate, so surface it verbatim rather than a
          // generic message.
          if (err?.status === 409) {
            Swal.fire({
              icon: 'warning',
              title: 'Cannot Delete Subject',
              text: err?.error?.detail ?? 'This subject is still in use elsewhere in the system.',
            });
            return;
          }
          Swal.fire({
            icon: 'error',
            title: 'Could not delete subject',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
    });
  }
}
