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

import { PasswordResetRequestsService } from '../../../core/services/password-reset-requests.service';
import { PasswordResetRequestRow } from '../../../core/models/auth.model';

type ReviewAction = 'approved' | 'rejected';

/**
 * Admin Operations > Password Requests — the approval queue for the
 * logged-out 'Request Password Reset from Admin' button on the login
 * screen. Backend: GET/PATCH /api/admin/password-reset-requests
 * (app/routers/password_requests.py), admin-only, pre-joined with the
 * requester's name/role/roll-or-employee-id so this screen needs no
 * second round-trip.
 *
 * Structurally near-identical to CoordinatorClassroomRequestsComponent —
 * same queue-with-review-dialog shape — kept as its own component since
 * it hits an entirely different backend router and audience (Admin-only,
 * not Admin/Coordinator).
 */
@Component({
  selector: 'app-admin-password-requests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, ButtonModule,
    DialogModule, TextareaModule, TagModule, ProgressSpinnerModule, MessageModule,
  ],
  templateUrl: './admin-password-requests.component.html',
  styleUrl: './admin-password-requests.component.scss',
})
export class AdminPasswordRequestsComponent implements OnInit {
  requests = signal<PasswordResetRequestRow[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  // --- Review dialog ---
  dialogOpen = signal(false);
  dialogAction = signal<ReviewAction>('approved');
  actioningRequest = signal<PasswordResetRequestRow | null>(null);
  reviewNote = signal('');
  submitting = signal(false);

  constructor(private passwordRequestsService: PasswordResetRequestsService) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  // Pending-only queue view; called again after every approve/reject so
  // the list reflects the decision immediately without a page reload.
  loadRequests(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.passwordRequestsService.listRequests('pending').subscribe({
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

  openDialog(row: PasswordResetRequestRow, action: ReviewAction): void {
    this.actioningRequest.set(row);
    this.dialogAction.set(action);
    this.reviewNote.set('');
    this.dialogOpen.set(true);
  }

  submitDecision(): void {
    const row = this.actioningRequest();
    if (!row) return;

    this.submitting.set(true);
    this.passwordRequestsService
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
            title: this.dialogAction() === 'approved' ? 'Password Reset' : 'Request Rejected',
            text:
              this.dialogAction() === 'approved'
                ? `${row.user_name}'s password has been reset to the temporary password. They must change it on their next login.`
                : `${row.user_name}'s request has been rejected. They have been notified.`,
            timer: 2600,
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
          this.loadRequests(); // the backend's 409 guard means "already reviewed" is a real possibility, not just a network blip
        },
      });
  }
}
