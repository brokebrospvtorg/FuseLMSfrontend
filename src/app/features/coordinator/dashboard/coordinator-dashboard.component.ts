import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AuthService } from '../../../core/services/auth.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { CommunicationService } from '../../../core/services/communication.service';
import { FeesService } from '../../../core/services/fees.service';
import { MarkEditRequestFull } from '../../../core/models/academics-staff.model';
import { SubjectRequestReviewRow } from '../../../core/models/academic.model';
import { Complaint } from '../../../core/models/communication.model';
import { FeeVoucher } from '../../../core/models/fees.model';
import { ComplaintStatus } from '../../../core/models/enums';

/**
 * Sub-Sprint 1 (Coordinator Portal) — Dashboard Overview.
 * Four quick-stat cards, each backed by an existing Admin/Coordinator-gated
 * endpoint (no new backend work needed — every source below already
 * restricts itself to admin/coordinator or scopes correctly for them):
 *   - Pending Mark Edit Requests  <- GET /api/academics/marks/edit-requests/pending
 *   - Open Complaints             <- GET /api/complaints (all, for admin/coordinator)
 *   - Pending Fee Proofs          <- GET /api/fees/vouchers, filtered to status 'submitted'
 *   - Unassigned Subject Requests <- GET /api/academic/subject-requests/review-queue (defaults to 'requested')
 * Each card links into the portal screen that actually handles that queue.
 */
@Component({
  selector: 'app-coordinator-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, ProgressSpinnerModule],
  templateUrl: './coordinator-dashboard.component.html',
  styleUrl: './coordinator-dashboard.component.scss',
})
export class CoordinatorDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private academicsStaffService = inject(AcademicsStaffService);
  private communicationService = inject(CommunicationService);
  private feesService = inject(FeesService);

  loading = signal(true);

  editRequests = signal<MarkEditRequestFull[]>([]);
  complaints = signal<Complaint[]>([]);
  vouchers = signal<FeeVoucher[]>([]);
  subjectRequests = signal<SubjectRequestReviewRow[]>([]);

  pendingMarkEditRequestsCount = computed(
    () => this.editRequests().filter((r) => r.status === 'pending').length,
  );

  openComplaintsCount = computed(
    () => this.complaints().filter((c) => c.status === ComplaintStatus.Open).length,
  );

  pendingFeeProofsCount = computed(
    () => this.vouchers().filter((v) => v.status === 'submitted').length,
  );

  // Review queue already defaults server-side to status_filter='requested'
  // (displayed as "Pending"/unassigned), so no client-side filter needed.
  unassignedSubjectRequestsCount = computed(() => this.subjectRequests().length);

  get coordinatorName(): string {
    return this.authService.currentUser()?.full_name ?? 'Coordinator';
  }

  ngOnInit(): void {
    let pending = 4;
    const done = () => {
      pending -= 1;
      if (pending === 0) this.loading.set(false);
    };

    this.academicsStaffService.getPendingMarkEditRequests().subscribe({
      next: (data) => { this.editRequests.set(data); done(); },
      error: () => done(), // card just shows 0 — not critical enough to block the page
    });

    this.communicationService.getMyComplaints().subscribe({
      next: (data) => { this.complaints.set(data); done(); },
      error: () => done(),
    });

    this.feesService.getAllVouchers().subscribe({
      next: (data) => { this.vouchers.set(data); done(); },
      error: () => done(),
    });

    this.academicsStaffService.getSubjectRequestQueue('requested').subscribe({
      next: (data) => { this.subjectRequests.set(data); done(); },
      error: () => done(),
    });
  }
}
