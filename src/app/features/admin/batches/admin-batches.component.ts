import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { SystemService } from '../../../core/services/system.service';
import { Batch, GeneratedBatchTemplate, BatchSummary } from '../../../core/models/academic.model';
import { BatchSession } from '../../../core/models/enums';
import { BatchSummaryDialogComponent } from './batch-summary-dialog.component';
import { ManageBatchDialogComponent } from './manage-batch-dialog.component';
import { generateBatchOptions } from '../../../shared/utils/batch-generator.util';

/**
 * Admin: Batches.
 *
 * Batch creation is deliberately NOT a free-text form — the "Create
 * Batch" dropdown is sourced straight from the backend's Batch Generator
 * (GET /api/academic/batches/generate, itself built on
 * app/core/batch_utils.generate_batches), so an Admin can only ever pick
 * a standardized "May/June {year}" or "Oct/Nov {year}" combination
 * within the current-year-plus-4 window that doesn't already exist. See
 * shared/utils/batch-generator.util.ts for the frontend-side mirror of
 * that same generator (used here just to keep option labels consistent
 * before the backend list has loaded).
 *
 * Batches don't need to be manually removed here: a daily job
 * (expire_ended_batches, app/core/jobs.py) soft-deletes a batch — and
 * every subject request, enrollment, assignment, timetable slot,
 * attendance record, fee voucher/proof, assessment/mark, and grade tied
 * to it — once the next standard batch's month arrives. "Run batch
 * expiry now" below just triggers that same job on demand.
 *
 * Each row is clickable and opens the Batch Summary drawer
 * (BatchSummaryDialogComponent) — total active students, assigned
 * teachers, and active subjects/classes for that batch (GET
 * /api/v1/batches/{batch_id}/summary). This replaces the old inline
 * "Manage / Add Subjects" action: subjects are now a pre-declared
 * catalog assigned elsewhere (Teacher assignment / Student enrollment),
 * not created per-batch here.
 */
@Component({
  selector: 'app-admin-batches',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule,
    ButtonModule, TagModule, ProgressSpinnerModule, ToggleSwitchModule, DialogModule,
    BatchSummaryDialogComponent, ManageBatchDialogComponent,
  ],
  templateUrl: './admin-batches.component.html',
  styleUrl: './admin-batches.component.scss',
})
export class AdminBatchesComponent implements OnInit {
  batches = signal<Batch[]>([]);
  templates = signal<GeneratedBatchTemplate[]>([]);
  loading = signal(true);

  /** GET /api/academic/batches (routers/academic.py's list_batches) now
   *  returns the full order itself — ACTIVE batches first, sorted
   *  chronologically (year ASC, e.g. 2025 Active before 2026 Active),
   *  with inactive/completed batches always pushed to the bottom
   *  (chronological within that group too). This signal is a deliberate
   *  pass-through, not a re-sort: re-sorting here with different logic
   *  than the backend is exactly what made the list order wrong before —
   *  the backend's order is the one source of truth, honored as-is. */
  filteredBatches = computed(() => this.batches());

  creating = signal(false);
  settingCurrentId = signal<string | null>(null);
  togglingActiveId = signal<string | null>(null);
  runningExpiry = signal(false);

  // Only offer generator combinations that don't already have a real
  // Batch row — creating a duplicate for the same session+year is
  // otherwise meaningless (and the backend would reject a mismatched
  // name/date pair for one that does exist).
  creatableOptions = computed(() =>
    this.templates()
      .filter((t) => !t.already_exists)
      .map((t) => ({ label: t.name, value: `${t.session}:${t.year}` })),
  );

  selectedTemplateKey = signal<string | null>(null);

  // --- Batch Summary drawer (clickable row) ---
  summaryDialogOpen = signal(false);
  summaryLoading = signal(false);
  summaryError = signal<string | null>(null);
  summaryData = signal<BatchSummary | null>(null);

  // --- Manage Subjects & Teachers dialog ("Manage" row action) ---
  manageDialogOpen = signal(false);
  manageBatch = signal<Batch | null>(null);

  // --- Edit Session/Year dialog ("Edit" row action) ---
  // Lets Admin correct a batch's exam session (May/June vs Oct/Nov)
  // and/or its target year after creation — the only fields PUT
  // /academic/batches/{batch_id} accepts (see UpdateBatchPayload).
  // A single dropdown, not separate Session + Year controls — options
  // come straight from the same generateBatchOptions() generator that
  // powers "Create next standard batch" above, so an Admin can only ever
  // retarget a batch onto a standardized May/June/Oct/Nov {year} slot,
  // never a free-typed session or year.
  editDialogOpen = signal(false);
  editBatch = signal<Batch | null>(null);
  editSelectionKey = signal<string | null>(null);
  savingBatchEdit = signal(false);

  // generateBatchOptions() only covers the standard current-year-plus-4
  // window, so a batch edited long after creation (or one that predates
  // the window shifting) might not appear in it — fall back to
  // prepending the batch's own current session/year so the dropdown
  // always has a valid pre-selected value to show.
  editSessionYearOptions = computed(() => {
    const options = generateBatchOptions().map(({ label, value }) => ({ label, value }));
    const batch = this.editBatch();
    if (batch) {
      const currentKey = `${batch.session}:${batch.year}`;
      if (!options.some((o) => o.value === currentKey)) {
        options.unshift({ label: batch.name, value: currentKey });
      }
    }
    return options;
  });

  constructor(
    private academicsStaffService: AcademicsStaffService,
    private systemService: SystemService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.academicsStaffService.getBatches().subscribe({
      next: (batches) => {
        this.batches.set(batches);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.academicsStaffService.getGeneratedBatchTemplates().subscribe({
      next: (templates) => this.templates.set(templates),
    });
  }

  createSelectedBatch(): void {
    const key = this.selectedTemplateKey();
    if (!key) return;
    const [session, yearStr] = key.split(':');
    const year = Number(yearStr);

    this.creating.set(true);
    this.academicsStaffService.createBatch({ session: session as BatchSession, year }).subscribe({
      next: () => {
        this.creating.set(false);
        this.selectedTemplateKey.set(null);
        Swal.fire({ icon: 'success', title: 'Batch created', confirmButtonColor: '#101d3c' });
        this.loadAll();
      },
      error: (err) => {
        this.creating.set(false);
        Swal.fire({ icon: 'error', title: 'Could not create batch', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  setCurrent(batch: Batch): void {
    this.settingCurrentId.set(batch.id);
    this.academicsStaffService.setCurrentBatch(batch.id).subscribe({
      next: () => {
        this.settingCurrentId.set(null);
        this.loadAll();
      },
      error: (err) => {
        this.settingCurrentId.set(null);
        Swal.fire({ icon: 'error', title: 'Could not set current batch', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  /**
   * Bound to `<p-toggleswitch [(ngModel)]="batch.is_active">` — by the
   * time this fires, PrimeNG has already flipped `batch.is_active` on
   * the row's own object (that's how the switch visually renders as
   * toggled), so we just persist that new value and roll it back if the
   * PATCH fails. batches() holds the same object references the table
   * renders, so mutating `batch` in place is enough to update the UI —
   * no need to re-set the `batches` signal for this one field.
   */
  toggleActive(batch: Batch): void {
    const newValue = batch.is_active;
    this.togglingActiveId.set(batch.id);

    this.academicsStaffService.setBatchActive(batch.id, newValue).subscribe({
      next: () => this.togglingActiveId.set(null),
      error: (err) => {
        batch.is_active = !newValue; // revert the optimistic toggle
        this.togglingActiveId.set(null);
        Swal.fire({
          icon: 'error',
          title: 'Could not update active status',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  runExpiryNow(): void {
    this.runningExpiry.set(true);
    this.systemService.triggerBatchExpiry().subscribe({
      next: (result) => {
        this.runningExpiry.set(false);
        const names = result.expired_batches.map((b) => b.name).join(', ');
        Swal.fire({
          icon: 'success',
          title: `${result.expired_count} batch(es) expired`,
          text: result.expired_count > 0 ? names : 'Nothing was due to expire.',
          confirmButtonColor: '#101d3c',
        });
        this.loadAll();
      },
      error: (err) => {
        this.runningExpiry.set(false);
        Swal.fire({ icon: 'error', title: 'Could not run batch expiry', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  /** Row click handler — opens the Batch Summary drawer for this batch. */
  openBatchSummary(batch: Batch): void {
    this.summaryDialogOpen.set(true);
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.summaryData.set(null);

    this.academicsStaffService.getBatchSummary(batch.id).subscribe({
      next: (summary) => {
        this.summaryData.set(summary);
        this.summaryLoading.set(false);
      },
      error: (err) => {
        this.summaryLoading.set(false);
        this.summaryError.set(err?.error?.detail ?? 'Could not load the batch summary. Please try again.');
      },
    });
  }

  closeBatchSummary(): void {
    this.summaryDialogOpen.set(false);
    this.summaryData.set(null);
    this.summaryError.set(null);
  }

  /** "Manage" row action — opens the Offer Subjects / Assign Teacher
   *  dialog for this batch. Separate from openBatchSummary() above: the
   *  summary drawer is read-only, this one writes. */
  openManageBatch(batch: Batch): void {
    this.manageBatch.set(batch);
    this.manageDialogOpen.set(true);
  }

  closeManageBatch(): void {
    this.manageDialogOpen.set(false);
    this.manageBatch.set(null);
  }

  /** The dialog's Offer Subjects / Assign Teacher actions can change
   *  active_students_count / assigned_teachers_count on this batch —
   *  reload so the table stays in sync without closing the dialog. */
  onManageBatchSaved(): void {
    this.loadAll();
  }

  /** "Edit" row action — opens the Edit Session/Year dialog, pre-filled
   *  with this batch's current session and year. */
  openEditBatch(batch: Batch): void {
    this.editBatch.set(batch);
    this.editSelectionKey.set(`${batch.session}:${batch.year}`);
    this.editDialogOpen.set(true);
  }

  closeEditBatch(): void {
    this.editDialogOpen.set(false);
    this.editBatch.set(null);
    this.editSelectionKey.set(null);
  }

  saveBatchEdit(): void {
    const batch = this.editBatch();
    const key = this.editSelectionKey();
    if (!batch || !key) return;
    const [session, yearStr] = key.split(':');
    const year = Number(yearStr);

    this.savingBatchEdit.set(true);
    this.academicsStaffService.updateBatch(batch.id, { session, year }).subscribe({
      next: () => {
        this.savingBatchEdit.set(false);
        Swal.fire({ icon: 'success', title: 'Batch updated', confirmButtonColor: '#101d3c' });
        this.closeEditBatch();
        // The router re-derives name/start_date/end_date from the
        // resulting session+year — reload so the table reflects the
        // change immediately, not just after a manual refresh.
        this.loadAll();
      },
      error: (err) => {
        this.savingBatchEdit.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not update batch',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }
}