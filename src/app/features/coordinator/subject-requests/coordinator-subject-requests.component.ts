import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { SubjectRequestReviewRow } from '../../../core/models/academic.model';
import { SubjectRequestStatus } from '../../../core/models/enums';

type QueueFilter = 'requested' | 'approved' | 'rejected' | '';

/**
 * Sub-Sprint 6.1 — Coordinator's Subject Requests approval queue.
 * Backend: GET/PATCH /api/academic/subject-requests/{review-queue,{id}}
 * (app/routers/academic.py) — both already role-gated to admin/coordinator,
 * and the model's status enum is requested/approved/rejected (displayed as
 * Pending/Approved/Rejected here — the enum itself wasn't renamed since
 * that would need a DB migration outside this sub-sprint's scope).
 */
@Component({
  selector: 'app-coordinator-subject-requests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, TextareaModule, TagModule, ProgressSpinnerModule,
  ],
  templateUrl: './coordinator-subject-requests.component.html',
  styleUrl: './coordinator-subject-requests.component.scss',
})
export class CoordinatorSubjectRequestsComponent implements OnInit {
  filterOptions = [
    { label: 'Pending', value: 'requested' as QueueFilter },
    { label: 'Approved', value: 'approved' as QueueFilter },
    { label: 'Rejected', value: 'rejected' as QueueFilter },
    { label: 'All', value: '' as QueueFilter },
  ];
  selectedFilter = signal<QueueFilter>('requested');

  requests = signal<SubjectRequestReviewRow[]>([]);
  loading = signal(true);

  // --- Approve/Reject dialog ---
  dialogOpen = signal(false);
  dialogAction = signal<'approved' | 'rejected'>('approved');
  actioningRequest = signal<SubjectRequestReviewRow | null>(null);
  comment = signal('');
  submitting = signal(false);

  readonly SubjectRequestStatus = SubjectRequestStatus;

  constructor(private staffService: AcademicsStaffService) {}

  ngOnInit(): void {
    this.loadQueue();
  }

  loadQueue(): void {
    this.loading.set(true);
    this.staffService.getSubjectRequestQueue(this.selectedFilter()).subscribe({
      next: (rows) => {
        this.requests.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Could not load subject requests', text: 'Please try again.' });
      },
    });
  }

  onFilterChanged(): void {
    this.loadQueue();
  }

  openDialog(row: SubjectRequestReviewRow, action: 'approved' | 'rejected'): void {
    this.actioningRequest.set(row);
    this.dialogAction.set(action);
    this.comment.set('');
    this.dialogOpen.set(true);
  }

  submitDecision(): void {
    const row = this.actioningRequest();
    if (!row) return;

    this.submitting.set(true);
    this.staffService
      .reviewSubjectRequest(row.id, { status: this.dialogAction(), comment: this.comment().trim() || undefined })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: this.dialogAction() === 'approved' ? 'Request approved' : 'Request rejected',
            text: `${row.student_name} has been notified.`,
            timer: 2200,
            showConfirmButton: false,
          });
          this.loadQueue();
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not submit decision',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
  }
}
