import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { Subject } from '../../../core/models/academic.model';
import { AddSubjectDialogComponent } from './add-subject-dialog.component';

/**
 * Admin/Coordinator: Subject Catalog list + "Add Subject" trigger
 * (schema_update_16). Restores the tab AcademicsManagementComponent's own
 * docstring documents as deliberately removed by schema_update_11 — see
 * that component's history for why this had been Batches-only until now.
 */
@Component({
  selector: 'app-admin-subject-catalog',
  standalone: true,
  imports: [
    CommonModule, CardModule, TableModule, ButtonModule, TagModule,
    ProgressSpinnerModule, MessageModule, AddSubjectDialogComponent,
  ],
  templateUrl: './admin-subject-catalog.component.html',
  styleUrl: './admin-subject-catalog.component.scss',
})
export class AdminSubjectCatalogComponent implements OnInit {
  subjects = signal<Subject[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  dialogVisible = signal(false);

  constructor(private academicsStaffService: AcademicsStaffService) {}

  ngOnInit(): void {
    this.loadSubjects();
  }

  private loadSubjects(): void {
    this.loading.set(true);
    this.error.set(null);
    this.academicsStaffService.getSubjects().subscribe({
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

  openAddSubject(): void {
    this.dialogVisible.set(true);
  }

  onDialogClosed(): void {
    this.dialogVisible.set(false);
  }

  /** New subject already came back from the dialog's successful POST —
   *  no need to re-fetch, just re-run the same list load so ordering/
   *  level-name joins stay consistent with what the server would return. */
  onSubjectSaved(): void {
    this.loadSubjects();
  }
}
