import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AuthService } from '../../../core/services/auth.service';
import { RegistryService } from '../../../core/services/registry.service';
import { CommunicationService } from '../../../core/services/communication.service';
import { FeesService } from '../../../core/services/fees.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { RegistryUser } from '../../../core/models/registry.model';
import { Complaint } from '../../../core/models/communication.model';
import { FeeVoucher } from '../../../core/models/fees.model';
import { SubjectRequestReviewRow } from '../../../core/models/academic.model';
import { AuditLogEntry } from '../../../core/models/academics-staff.model';
import { ComplaintStatus, UserRole } from '../../../core/models/enums';

/**
 * Admin Sub-Sprint 2 — Dashboard & Overview.
 * Every number here comes from an endpoint that already exists and is
 * already admin-accessible — same "reuse, don't add a new backend
 * endpoint" approach the Coordinator Dashboard (Sub-Sprint 1) established:
 *   - Users by role          <- GET /api/users (RegistryService.getUsers())
 *   - Active classes         <- GET /api/academic/subject-requests/review-queue?status_filter=approved,
 *                                counted as distinct subject+batch pairs (each approved
 *                                request is what actually creates the enrollment row)
 *   - Pending fee proofs     <- GET /api/fees/vouchers, filtered to status 'submitted'
 *   - Unresolved complaints  <- GET /api/complaints (all, for admin), Open + In Progress
 *   - Recent audit log       <- GET /api/audit-logs (existing, admin-only — just never had
 *                                a frontend caller before this; see AuditLogService)
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, ProgressSpinnerModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private registryService = inject(RegistryService);
  private communicationService = inject(CommunicationService);
  private feesService = inject(FeesService);
  private academicsStaffService = inject(AcademicsStaffService);
  private auditLogService = inject(AuditLogService);

  loading = signal(true);

  users = signal<RegistryUser[]>([]);
  complaints = signal<Complaint[]>([]);
  vouchers = signal<FeeVoucher[]>([]);
  approvedSubjectRequests = signal<SubjectRequestReviewRow[]>([]);
  auditLogs = signal<AuditLogEntry[]>([]);

  get adminName(): string {
    return this.authService.currentUser()?.full_name ?? 'Admin';
  }

  usersByRole = computed<{ role: string; count: number }[]>(() => {
    const counts = new Map<string, number>();
    for (const role of Object.values(UserRole)) counts.set(role, 0);
    for (const user of this.users()) {
      counts.set(user.role, (counts.get(user.role) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([role, count]) => ({ role, count }));
  });

  totalUsersCount = computed(() => this.users().length);

  activeClassesCount = computed(() => {
    const seen = new Set(this.approvedSubjectRequests().map((r) => `${r.subject_id}:${r.batch_id}`));
    return seen.size;
  });

  pendingFeeProofsCount = computed(
    () => this.vouchers().filter((v) => v.status === 'submitted').length,
  );

  unresolvedComplaintsCount = computed(
    () => this.complaints().filter(
      (c) => c.status === ComplaintStatus.Open || c.status === ComplaintStatus.InProgress,
    ).length,
  );

  /** Actor names joined client-side from the same user list already
   *  fetched for the "users by role" card — AuditLogOut only carries
   *  user_id, and adding a second backend call/join just for a display
   *  name isn't worth it when this list is already in memory. */
  recentAuditLogs = computed(() => {
    const nameById = new Map(this.users().map((u) => [u.id, u.full_name]));
    return this.auditLogs()
      .slice(0, 5)
      .map((log) => ({ ...log, actor_name: nameById.get(log.user_id) ?? 'Unknown user' }));
  });

  roleLabel(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  actionLabel(action: string): string {
    return action.replace(/_/g, ' ');
  }

  ngOnInit(): void {
    let pending = 5;
    const done = () => {
      pending -= 1;
      if (pending === 0) this.loading.set(false);
    };

    this.registryService.getUsers().subscribe({
      next: (data) => { this.users.set(data); done(); },
      error: () => done(), // cards just show 0 — not critical enough to block the page
    });

    this.communicationService.getMyComplaints().subscribe({
      next: (data) => { this.complaints.set(data); done(); },
      error: () => done(),
    });

    this.feesService.getAllVouchers().subscribe({
      next: (data) => { this.vouchers.set(data); done(); },
      error: () => done(),
    });

    this.academicsStaffService.getSubjectRequestQueue('approved').subscribe({
      next: (data) => { this.approvedSubjectRequests.set(data); done(); },
      error: () => done(),
    });

    this.auditLogService.getAuditLogs().subscribe({
      next: (data) => { this.auditLogs.set(data); done(); },
      error: () => done(),
    });
  }
}
