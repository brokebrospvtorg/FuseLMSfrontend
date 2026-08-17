import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { MarkEditRequestFull } from '../../../core/models/academics-staff.model';

type ReviewAction = 'approved' | 'rejected';

/**
 * Coordinator Sub-Sprint 2 — Marks Edit Request Queue (Sub-Sprint 5 tie-off).
 * Backend: GET /api/academics/marks/edit-requests/pending,
 * PATCH /api/academics/marks/edit-requests/{id} (app/routers/marks.py),
 * both already role-gated to coordinator/admin. Approving writes the
 * requested change straight to the Mark row and notifies the requesting
 * Teacher server-side either way — nothing further to do here on success
 * besides refreshing the list.
 *
 * The review-note field (schema_update_3.sql) follows the same optional
 * reviewer-note pattern already used for Subject Requests, Fee Proofs, and
 * Complaints elsewhere in the Coordinator portal.
 */
@Component({
  selector: 'app-coordinator-mark-edit-requests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, ButtonModule,
    DialogModule, TextareaModule, TagModule, ProgressSpinnerModule,
  ],
  templateUrl: './coordinator-mark-edit-requests.component.html',
  styleUrl: './coordinator-mark-edit-requests.component.scss',
})
export class CoordinatorMarkEditRequestsComponent implements OnInit {
  requests = signal<MarkEditRequestFull[]>([]);
  loading = signal(true);

  // --- Review dialog ---
  dialogOpen = signal(false);
  dialogAction = signal<ReviewAction>('approved');
  actioningRequest = signal<MarkEditRequestFull | null>(null);
  reviewNote = signal('');
  submitting = signal(false);

  constructor(private staffService: AcademicsStaffService) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading.set(true);
    this.staffService.getPendingMarkEditRequests().subscribe({
      next: (data) => {
        this.requests.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openDialog(row: MarkEditRequestFull, action: ReviewAction): void {
    this.actioningRequest.set(row);
    this.dialogAction.set(action);
    this.reviewNote.set('');
    this.dialogOpen.set(true);
  }

  submitDecision(): void {
    const row = this.actioningRequest();
    if (!row) return;

    this.submitting.set(true);
    this.staffService
      .reviewMarkEditRequest(row.id, {
        status: this.dialogAction(),
        review_note: this.reviewNote().trim() || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: this.dialogAction() === 'approved' ? 'Request approved' : 'Request rejected',
            text:
              this.dialogAction() === 'approved'
                ? `The mark has been updated and ${row.student_name}'s grade recomputed if applicable. The teacher has been notified.`
                : 'The teacher has been notified that this request was rejected.',
            timer: 2400,
            showConfirmButton: false,
          });
          this.loadRequests();
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not submit review',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
  }
}
