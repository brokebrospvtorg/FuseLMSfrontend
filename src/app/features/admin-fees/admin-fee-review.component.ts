import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';

import { FeesService } from '../../core/services/fees.service';
import { FeeVoucher } from '../../core/models/fees.model';

@Component({
  selector: 'app-admin-fee-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    TagModule,
    ButtonModule,
    DialogModule,
    TextareaModule,
    ProgressSpinnerModule,
    MessageModule,
    SelectModule,
  ],
  templateUrl: './admin-fee-review.component.html',
  styleUrl: './admin-fee-review.component.scss',
})
export class AdminFeeReviewComponent implements OnInit {
  // --- Roster ---
  vouchers = signal<FeeVoucher[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  // Requirement #1: only vouchers currently awaiting review. The backend
  // has no server-side status filter (status is derived, not a column),
  // so this filters client-side from the full list.
  pendingVouchers = computed(() => this.vouchers().filter((v) => v.status === 'submitted'));

  // --- Historical view (Sub-Sprint 5: "dropdown filter for last 3 months") ---
  // Everything the backend returns for Admin/Coordinator with no query
  // params is already every voucher ever generated — the "3 months"
  // window here is a client-side read filter, not a fetch-less-data
  // optimization, since there's no generated_at/due_date query param on
  // GET /api/fees/vouchers to filter server-side with today.
  historyFilterOptions = [
    { label: 'Last 3 Months', value: '3m' as const },
    { label: 'Last 6 Months', value: '6m' as const },
    { label: 'All Time', value: 'all' as const },
  ];
  historyFilter = signal<'3m' | '6m' | 'all'>('3m');
  showHistory = signal(false);

  historicalVouchers = computed(() => {
    const decided = this.vouchers().filter((v) => v.status === 'paid' || v.status === 'rejected');
    const filter = this.historyFilter();
    if (filter === 'all') return decided;

    const monthsBack = filter === '3m' ? 3 : 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monthsBack);
    return decided.filter((v) => new Date(v.generated_at) >= cutoff);
  });

  // --- Proof viewer dialog ---
  viewerVisible = signal(false);
  viewerLoading = signal(false);
  viewerError = signal<string | null>(null);
  viewerFileUrl = signal<string | null>(null); // object URL for the blob (img src)
  viewerSafePdfUrl = signal<SafeResourceUrl | null>(null); // sanitized, for iframe src
  viewerIsPdf = signal(false);
  activeVoucher = signal<FeeVoucher | null>(null);

  // --- Reject dialog ---
  rejectDialogVisible = signal(false);
  rejectReason = signal('');
  rejectTargetVoucher = signal<FeeVoucher | null>(null);

  // Per-row action state so only the row being acted on shows a spinner
  actioningProofId = signal<string | null>(null);

  constructor(private feesService: FeesService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.loadVouchers();
  }

  loadVouchers(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.feesService.getAllVouchers().subscribe({
      next: (data) => {
        this.vouchers.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load fee vouchers right now.');
        this.loading.set(false);
      },
    });
  }

  // --- Proof viewer ---
  openViewer(voucher: FeeVoucher): void {
    if (!voucher.latest_proof_id) return;

    this.activeVoucher.set(voucher);
    this.viewerVisible.set(true);
    this.viewerLoading.set(true);
    this.viewerError.set(null);
    this.releaseViewerUrl();

    this.feesService.getProofFile(voucher.latest_proof_id).subscribe({
      next: (blob) => {
        const isPdf = blob.type === 'application/pdf';
        const objectUrl = URL.createObjectURL(blob);
        this.viewerIsPdf.set(isPdf);
        this.viewerFileUrl.set(objectUrl);
        this.viewerSafePdfUrl.set(isPdf ? this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl) : null);
        this.viewerLoading.set(false);
      },
      error: () => {
        this.viewerError.set('Could not load this proof file. It may have been purged by the retention policy.');
        this.viewerLoading.set(false);
      },
    });
  }

  closeViewer(): void {
    this.viewerVisible.set(false);
    this.releaseViewerUrl();
  }

  private releaseViewerUrl(): void {
    const current = this.viewerFileUrl();
    if (current) URL.revokeObjectURL(current);
    this.viewerFileUrl.set(null);
    this.viewerSafePdfUrl.set(null);
  }

  // --- Approve ---
  approve(voucher: FeeVoucher): void {
    if (!voucher.latest_proof_id) return;
    this.actioningProofId.set(voucher.latest_proof_id);

    this.feesService.approveProof(voucher.latest_proof_id).subscribe({
      next: () => {
        this.actioningProofId.set(null);
        this.loadVouchers(); // refresh so this voucher drops out of pendingVouchers()
      },
      error: () => {
        this.actioningProofId.set(null);
        this.errorMessage.set('Could not approve this proof. Please try again.');
      },
    });
  }

  // --- Reject ---
  openRejectDialog(voucher: FeeVoucher): void {
    this.rejectTargetVoucher.set(voucher);
    this.rejectReason.set('');
    this.rejectDialogVisible.set(true);
  }

  confirmReject(): void {
    const voucher = this.rejectTargetVoucher();
    const reason = this.rejectReason().trim();
    if (!voucher?.latest_proof_id || !reason) return;

    this.actioningProofId.set(voucher.latest_proof_id);
    this.feesService.rejectProof(voucher.latest_proof_id, reason).subscribe({
      next: () => {
        this.actioningProofId.set(null);
        this.rejectDialogVisible.set(false);
        // Requirement #4: no separate "unblock" step needed — the student's
        // FeesComponent already shows the "Upload Proof" button for any
        // voucher whose status is 'pending' or 'rejected'. Refreshing this
        // list is what flips the derived status to 'rejected' on read,
        // which is what unblocks their re-upload button on their next load.
        this.loadVouchers();
      },
      error: () => {
        this.actioningProofId.set(null);
        this.errorMessage.set('Could not reject this proof. Please try again.');
      },
    });
  }
}
