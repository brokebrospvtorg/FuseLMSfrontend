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
import { BatchSession, Board } from '../../../core/models/enums';
import { BatchSummaryDialogComponent } from './batch-summary-dialog.component';
import { ManageBatchDialogComponent } from './manage-batch-dialog.component';
import { BOARD_OPTIONS } from '../../../shared/utils/board-options.util';

// Re-exported for backward compatibility — admin-registry.component.ts
// (and anything else) still imports BOARD_OPTIONS from here. The actual
// definition now lives in shared/utils/board-options.util.ts so
// manage-batch-dialog.component.ts can import it too without this file
// and that one importing each other (ManageBatchDialogComponent is
// imported below, so a BOARD_OPTIONS defined here would be circular).
export { BOARD_OPTIONS };

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
 * before the backend list has loaded). schema_update_11 additionally
 * requires an examining Board on every Batch, so Create now also needs
 * that picked before it's enabled.
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

  // --- Board tab filter ---
  // A Batch is not tied to a single board — it can simultaneously host
  // subjects/offerings under British Council, Edexcel, and LRN. So every
  // tab (including a specific board) shows the FULL batch list: an Admin
  // needs to be able to open ANY batch from the Edexcel tab, say, to
  // start offering Edexcel subjects on it for the first time, even though
  // it has zero Edexcel activity yet. Previously a specific tab hard-
  // filtered on the single `board` column and hid zero-activity batches —
  // that's exactly what made a batch look "stuck" under one board.
  // Selecting a tab now only changes which board's "Active" tag is shown
  // per row (see isActiveForBoard(), used directly in the template) and
  // sets the default board context handed to the Manage dialog — it never
  // removes a batch from the list, and no longer reorders it either.
  selectedBoardTab = signal<Board | 'all'>('all');

  /** GET /api/academic/batches (routers/academic.py's list_batches) now
   *  returns the full order itself — ACTIVE batches first, sorted
   *  chronologically (year ASC, e.g. 2025 Active before 2026 Active),
   *  with inactive/completed batches always pushed to the bottom
   *  (chronological within that group too). This signal is a deliberate
   *  pass-through, not a re-sort: re-sorting here with different logic
   *  than the backend is exactly what made the list order wrong before —
   *  the backend's order is the one source of truth, honored as-is, for
   *  All Batches and every board tab alike (British Council, Edexcel, LRN
   *  all read this same signal, so they inherit the same ordering for
   *  free — selecting a board tab only changes which board's "Active" tag
   *  is shown per row, never the row order). */
  filteredBatches = computed(() => this.batches());

  /** Whether `batch` has at least one active offered subject under
   *  `board` — used to render the "Active" tag per board tab instead of
   *  filtering the batch out of the list entirely. Accepts `Board | 'all'`
   *  (not just `Board`) because the template calls this from inside an
   *  `@else if` on `selectedBoardTab()`, and Angular template control flow
   *  doesn't narrow a signal's return type the way a TS `if` would — so
   *  the compiler still sees the full `Board | 'all'` type at the call
   *  site. 'all' has no meaningful "active" state, so it just returns
   *  false (this branch is never actually reached for 'all' — the 'all'
   *  case is handled by the sibling @if above it in the template). */
  isActiveForBoard(batch: Batch, board: Board | 'all'): boolean {
    if (board === 'all') return false;
    const boardLower = board.toLowerCase();
    return (batch.active_boards ?? []).some((b) => b.toLowerCase() === boardLower);
  }

  creating = signal(false);
  settingCurrentId = signal<string | null>(null);
  togglingActiveId = signal<string | null>(null);
  runningExpiry = signal(false);

  boardOptions = BOARD_OPTIONS;

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
  selectedBoard = signal<Board | null>(null);

  // --- Batch Summary drawer (clickable row) ---
  summaryDialogOpen = signal(false);
  summaryLoading = signal(false);
  summaryError = signal<string | null>(null);
  summaryData = signal<BatchSummary | null>(null);

  // --- Manage Subjects & Teachers dialog ("Manage" row action) ---
  manageDialogOpen = signal(false);
  manageBatch = signal<Batch | null>(null);
  manageBatchDefaultBoard = signal<Board | null>(null);

  // --- Edit Board dialog ("Edit" row action) ---
  // The Create dialog above already lets an Admin pick a board up front;
  // this is the other half — reassigning the board on a batch that
  // already exists (created under the wrong one, or that needs moving
  // later). Without this, a batch's board was permanently fixed at
  // creation with no way to change it, which is what left every batch
  // stuck under one tab.
  editDialogOpen = signal(false);
  editBatch = signal<Batch | null>(null);
  editBoardSelection = signal<Board | null>(null);
  savingBoardEdit = signal(false);

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
    const board = this.selectedBoard();
    if (!key || !board) return;
    const [session, yearStr] = key.split(':');
    const year = Number(yearStr);

    this.creating.set(true);
    this.academicsStaffService.createBatch({ session: session as BatchSession, year, board }).subscribe({
      next: () => {
        this.creating.set(false);
        this.selectedTemplateKey.set(null);
        this.selectedBoard.set(null);
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

  boardLabel(board: string): string {
    const boardLower = board?.toLowerCase();
    return this.boardOptions.find((o) => o.value.toLowerCase() === boardLower)?.label ?? board;
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
    // Pre-select the Manage dialog's board context from whichever Board
    // Tab the admin currently has selected (falls back to unselected on
    // the "All Boards" tab, where there's no single sensible default) —
    // saves a redundant click for the common "I'm on the Edexcel tab,
    // configuring Edexcel subjects for this batch" flow.
    const tab = this.selectedBoardTab();
    this.manageBatchDefaultBoard.set(tab === 'all' ? null : tab);
    this.manageDialogOpen.set(true);
  }

  closeManageBatch(): void {
    this.manageDialogOpen.set(false);
    this.manageBatch.set(null);
    this.manageBatchDefaultBoard.set(null);
  }

  /** The dialog's Offer Subjects / Assign Teacher actions can change
   *  active_students_count / assigned_teachers_count on this batch,
   *  which the Board tab filter reads — reload so the table and tabs
   *  stay in sync without closing the dialog. */
  onManageBatchSaved(): void {
    this.loadAll();
  }

  /** "Edit" row action — opens the Edit Board dialog, pre-filled with
   *  this batch's current board. */
  openEditBatch(batch: Batch): void {
    this.editBatch.set(batch);
    this.editBoardSelection.set(batch.board);
    this.editDialogOpen.set(true);
  }

  closeEditBatch(): void {
    this.editDialogOpen.set(false);
    this.editBatch.set(null);
    this.editBoardSelection.set(null);
  }

  saveBoardEdit(): void {
    const batch = this.editBatch();
    const board = this.editBoardSelection();
    if (!batch || !board) return;

    this.savingBoardEdit.set(true);
    this.academicsStaffService.updateBatch(batch.id, { board }).subscribe({
      next: () => {
        this.savingBoardEdit.set(false);
        Swal.fire({ icon: 'success', title: 'Board updated', confirmButtonColor: '#101d3c' });
        this.closeEditBatch();
        // The batch may now belong to a different Board tab (or drop out
        // of/appear in the currently selected one) — reload so the table
        // and tabs reflect the move immediately, not just after a manual
        // refresh.
        this.loadAll();
      },
      error: (err) => {
        this.savingBoardEdit.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not update board',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }
}