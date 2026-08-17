import { Component, OnInit, signal, computed } from '@angular/core';
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

import { CommunicationService } from '../../../core/services/communication.service';
import { Complaint } from '../../../core/models/communication.model';
import { ComplaintStatus } from '../../../core/models/enums';

type QueueFilter = ComplaintStatus | '';

/**
 * Sub-Sprint 4 (Coordinator Portal) — central inbox for complaints/feedback
 * from Students, Parents, and Teachers.
 * Backend: GET/PATCH /api/complaints (app/routers/complaints.py) — already
 * role-gated: the list endpoint auto-filters to "everything" for
 * admin/coordinator, and the PATCH is admin/coordinator-only.
 */
@Component({
  selector: 'app-coordinator-complaints',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, TextareaModule, TagModule, ProgressSpinnerModule,
  ],
  templateUrl: './coordinator-complaints.component.html',
  styleUrl: './coordinator-complaints.component.scss',
})
export class CoordinatorComplaintsComponent implements OnInit {
  filterOptions: { label: string; value: QueueFilter }[] = [
    { label: 'Open', value: ComplaintStatus.Open },
    { label: 'In Progress', value: ComplaintStatus.InProgress },
    { label: 'Resolved', value: ComplaintStatus.Resolved },
    { label: 'Closed', value: ComplaintStatus.Closed },
    { label: 'All', value: '' },
  ];
  selectedFilter = signal<QueueFilter>(ComplaintStatus.Open);

  allComplaints = signal<Complaint[]>([]);
  loading = signal(true);

  filteredComplaints = computed(() => {
    const filter = this.selectedFilter();
    if (!filter) return this.allComplaints();
    return this.allComplaints().filter((c) => c.status === filter);
  });

  // --- Respond dialog ---
  dialogOpen = signal(false);
  actioningComplaint = signal<Complaint | null>(null);
  newStatus = signal<ComplaintStatus>(ComplaintStatus.InProgress);
  resolutionMessage = signal('');
  submitting = signal(false);

  readonly ComplaintStatus = ComplaintStatus;

  statusOptions = [
    { label: 'In Progress', value: ComplaintStatus.InProgress },
    { label: 'Resolved', value: ComplaintStatus.Resolved },
    { label: 'Closed', value: ComplaintStatus.Closed },
  ];

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.loadComplaints();
  }

  loadComplaints(): void {
    this.loading.set(true);
    // The backend has no status_filter query param (unlike subject-requests) —
    // list_complaints returns everything the caller is allowed to see, so
    // filtering happens client-side via filteredComplaints() above.
    this.communicationService.getMyComplaints().subscribe({
      next: (rows) => {
        this.allComplaints.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Could not load complaints', text: 'Please try again.' });
      },
    });
  }

  openRespondDialog(complaint: Complaint): void {
    this.actioningComplaint.set(complaint);
    // Sensible next step: Open -> In Progress, In Progress/anything else -> Resolved.
    this.newStatus.set(complaint.status === ComplaintStatus.Open ? ComplaintStatus.InProgress : ComplaintStatus.Resolved);
    this.resolutionMessage.set(complaint.resolution_message ?? '');
    this.dialogOpen.set(true);
  }

  submitResponse(): void {
    const complaint = this.actioningComplaint();
    if (!complaint) return;

    this.submitting.set(true);
    this.communicationService
      .resolveComplaint(complaint.id, {
        status: this.newStatus(),
        resolution_message: this.resolutionMessage().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: 'Response sent',
            text: `${complaint.submitted_by_name} has been notified.`,
            timer: 2200,
            showConfirmButton: false,
          });
          this.loadComplaints();
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not submit response',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
  }

  severityFor(status: ComplaintStatus): 'danger' | 'warn' | 'success' | 'secondary' {
    switch (status) {
      case ComplaintStatus.Open: return 'danger';
      case ComplaintStatus.InProgress: return 'warn';
      case ComplaintStatus.Resolved: return 'success';
      case ComplaintStatus.Closed: return 'secondary';
    }
  }
}
