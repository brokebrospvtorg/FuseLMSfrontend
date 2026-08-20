import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { BatchSummary } from '../../../core/models/academic.model';

/**
 * Batch Summary drawer — the clickable Batch row's inline detail view.
 * Presentational only: the parent (AdminBatchesComponent) owns the
 * open/loading/error/data state and the getBatchSummary() call, this
 * component just renders whatever it's given.
 *
 * Rendered as a right-side slide-over via p-dialog's `position="right"`
 * rather than pulling in a separate Sidebar/Drawer module, since
 * DialogModule is already a project-wide dependency (see
 * admin-registry.component.ts) and this keeps the same modal/dismiss
 * behavior (backdrop click, Esc) the rest of the app already uses.
 *
 * Strictly an Admin/Coordinator view — the parent only ever calls
 * openBatchSummary() from a route already gated to those two roles (see
 * app.routes.ts's roleGuard on the /admin and /coordinator trees), and
 * the backend independently 403s anyone else on GET
 * /api/v1/batches/{batch_id}/summary regardless.
 */
@Component({
  selector: 'app-batch-summary-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, TagModule, ProgressSpinnerModule, MessageModule],
  templateUrl: './batch-summary-dialog.component.html',
  styleUrl: './batch-summary-dialog.component.scss',
})
export class BatchSummaryDialogComponent {
  @Input() visible = false;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() summary: BatchSummary | null = null;

  @Output() closed = new EventEmitter<void>();

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }
}
