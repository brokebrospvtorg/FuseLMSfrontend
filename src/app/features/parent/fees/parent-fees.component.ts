import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule, FileUploadHandlerEvent } from 'primeng/fileupload';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ParentService } from '../../../core/services/parent.service';
import { FeesService } from '../../../core/services/fees.service';
import { ParentChild } from '../../../core/models/parent.model';
import { FeeVoucher, DerivedVoucherStatus } from '../../../core/models/fees.model';

@Component({
  selector: 'app-parent-fees',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    TagModule,
    SelectModule,
    ButtonModule,
    FileUploadModule,
    DialogModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './parent-fees.component.html',
  styleUrl: './parent-fees.component.scss',
})
export class ParentFeesComponent implements OnInit {
  children = signal<ParentChild[]>([]);
  childrenLoading = signal(true);
  childrenError = signal<string | null>(null);
  selectedChild = signal<ParentChild | null>(null);

  // The backend returns every linked child's vouchers in one call (same
  // endpoint the Student portal calls) — fetched once, filtered client-side
  // per selected child rather than re-fetched on every switch.
  allVouchers = signal<FeeVoucher[]>([]);
  vouchersLoading = signal(true);
  vouchersError = signal<string | null>(null);

  vouchersForSelectedChild = computed(() => {
    const child = this.selectedChild();
    if (!child) return [];
    return this.allVouchers().filter((v) => v.student_id === child.student_id);
  });

  uploadDialogVisible = signal(false);
  activeVoucherId = signal<string | null>(null);
  uploading = signal(false);

  constructor(
    private parentService: ParentService,
    private feesService: FeesService,
  ) {}

  ngOnInit(): void {
    this.parentService.getMyChildren().subscribe({
      next: (children) => {
        this.children.set(children);
        this.childrenLoading.set(false);
        if (children.length > 0) {
          this.selectedChild.set(children[0]);
        }
      },
      error: () => {
        this.childrenError.set('Could not load your linked children right now.');
        this.childrenLoading.set(false);
      },
    });

    this.loadVouchers();
  }

  private loadVouchers(): void {
    this.vouchersLoading.set(true);
    this.feesService.getMyVouchers().subscribe({
      next: (data) => {
        this.allVouchers.set(data);
        this.vouchersLoading.set(false);
      },
      error: () => {
        this.vouchersError.set('Could not load fee vouchers right now.');
        this.vouchersLoading.set(false);
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
}
