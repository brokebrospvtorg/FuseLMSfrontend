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
import { MessageModule } from 'primeng/message';

import { ClassroomRequestsService } from '../../../core/services/classroom-requests.service';
import { ClassroomEditRequest } from '../../../core/models/content.model';

type ReviewAction = 'approved' | 'rejected';

/**
 * Lectures Sub-Sprint 4 — Admin/Coordinator Approval Dashboard.
 * Backend: GET/PATCH /api/classroom-requests (app/routers/content.py's
 * classroom_requests_router), already role-gated to admin/coordinator,
 * already returns lecture_title/subject_name/current_url/requester_name
 * pre-joined so this screen needs no second round-trip for the
 * current-vs-proposed comparison (Task 4.2).
 *
 * Structurally near-identical to CoordinatorMarkEditRequestsComponent —
 * same queue-with-review-dialog shape — kept as its own component rather
 * than a generic shared one since the two request types have different
 * fields to show (a URL diff here vs. a numeric mark change there) and
 * hit an entirely different backend router.
 */
@Component({
  selector: 'app-coordinator-classroom-requests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, ButtonModule,
    DialogModule, TextareaModule, TagModule, ProgressSpinnerModule, MessageModule,
  ],
  templateUrl: './coordinator-classroom-requests.component.html',
  styleUrl: './coordinator-classroom-requests.component.scss',
})
export class CoordinatorClassroomRequestsComponent implements OnInit {
  requests = signal<ClassroomEditRequest[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  // --- Review dialog ---
  dialogOpen = signal(false);
  dialogAction = signal<ReviewAction>('approved');
  actioningRequest = signal<ClassroomEditRequest | null>(null);
  reviewNote = signal('');
  submitting = signal(false);

  constructor(private classroomRequestsService: ClassroomRequestsService) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  // Task 4.1 + 4.4 — pending-only queue view; called again after every
  // approve/reject so the list reflects the decision immediately without
  // a page reload.
  loadRequests(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.classroomRequestsService.listRequests('pending').subscribe({
      next: (data) => {
        this.requests.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load pending requests right now.');
        this.loading.set(false);
      },
    });
  }

  openDialog(row: ClassroomEditRequest, action: ReviewAction): void {
    this.actioningRequest.set(row);
    this.dialogAction.set(action);
    this.reviewNote.set('');
    this.dialogOpen.set(true);
  }

  // Task 4.3 — SweetAlert confirmation on the resulting decision (the
  // dialog itself is the "are you sure" step; this is the outcome toast).
  submitDecision(): void {
    const row = this.actioningRequest();
    if (!row) return;

    this.submitting.set(true);
    this.classroomRequestsService
      .reviewRequest(row.id, {
        status: this.dialogAction(),
        review_note: this.reviewNote().trim() || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: this.dialogAction() === 'approved' ? 'Link change approved' : 'Link change rejected',
            text:
              this.dialogAction() === 'approved'
                ? `"${row.lecture_title}"'s classroom link is now updated. ${row.requester_name} has been notified.`
                : `${row.requester_name} has been notified that this request was rejected.`,
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
            text: err?.error?.detail ?? 'This request may have already been reviewed by someone else — refresh and check.',
          });
          this.loadRequests(); // Task 2.3's 409 guard means "already reviewed" is a real possibility, not just a network blip
        },
      });
  }
}
