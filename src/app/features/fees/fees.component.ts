import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule, FileUploadHandlerEvent } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { FeesService } from '../../core/services/fees.service';
import { FeeVoucher, DerivedVoucherStatus } from '../../core/models/fees.model';

@Component({
  selector: 'app-fees',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TableModule,
    TagModule,
    ButtonModule,
    FileUploadModule,
    DialogModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './fees.component.html',
  styleUrl: './fees.component.scss',
})
export class FeesComponent implements OnInit {
  vouchers = signal<FeeVoucher[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  uploadDialogVisible = signal(false);
  activeVoucherId = signal<string | null>(null);
  uploading = signal(false);

  constructor(private feesService: FeesService) {}

  ngOnInit(): void {
    this.loadVouchers();
  }

  loadVouchers(): void {
    this.loading.set(true);
    this.feesService.getMyVouchers().subscribe({
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

  openUploadDialog(voucherId: string): void {
    this.activeVoucherId.set(voucherId);
    this.uploadDialogVisible.set(true);
  }

  onUpload(event: FileUploadHandlerEvent): void {
    const voucherId = this.activeVoucherId();
    const file = event.files[0];
    if (!voucherId || !file) return;

    this.uploading.set(true);
    this.feesService.uploadProof(voucherId, file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.uploadDialogVisible.set(false);
        this.loadVouchers(); // refresh so the derived status reflects the new proof
      },
      error: () => {
        this.uploading.set(false);
      },
    });
  }

  severityFor(status: DerivedVoucherStatus): 'success' | 'warn' | 'danger' | 'info' {
    switch (status) {
      case 'paid':
        return 'success';
      case 'submitted':
        return 'info';
      case 'rejected':
        return 'danger';
      default:
        return 'warn';
    }
  }

  labelFor(status: DerivedVoucherStatus): string {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'submitted':
        return 'Under Review';
      case 'rejected':
        return 'Rejected — Re-upload Needed';
      default:
        return 'Pending';
    }
  }
}
