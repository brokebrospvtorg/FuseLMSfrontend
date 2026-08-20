import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { Level, Subject } from '../../../core/models/academic.model';
import { Board } from '../../../core/models/enums';
import { SUBJECT_BOARD_OPTIONS } from '../../../shared/utils/board-options.util';

/**
 * Admin/Coordinator: "Add Subject" dialog (schema_update_16). Restores the
 * create-subject form schema_update_11 deliberately removed — see that
 * migration's own note and app/models/academic.py Subject's docstring for
 * the history. Only lets the user pick from the 4 standardized, active
 * Levels (loaded from GET /api/academic/levels, which is itself now
 * scoped to just those 4 — see routers/academic.py STANDARD_LEVEL_CODES),
 * so there's no way to accidentally map a new subject to a legacy/junk
 * level from before the schema_update_16 cleanup.
 *
 * Presentational + self-contained data loading, same split as
 * ManageBatchDialogComponent: the parent only owns `visible`, and reloads
 * its own subject list on `saved`.
 *
 * Follows this codebase's established pattern (signals + FormsModule
 * `[ngModel]`/`(ngModelChange)`, not ReactiveFormsModule) for consistency
 * with ManageBatchDialogComponent / AdminBatchesComponent.
 */
@Component({
  selector: 'app-add-subject-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DialogModule, SelectModule, CheckboxModule,
    ButtonModule, InputTextModule, MessageModule,
  ],
  templateUrl: './add-subject-dialog.component.html',
  styleUrl: './add-subject-dialog.component.scss',
})
export class AddSubjectDialogComponent implements OnChanges {
  @Input() visible = false;

  @Output() closed = new EventEmitter<void>();
  /** Emitted after a successful create, with the new Subject — parent
   *  should append it (or just reload its catalog list) to refresh. */
  @Output() saved = new EventEmitter<Subject>();

  boardOptions = SUBJECT_BOARD_OPTIONS;

  levels = signal<Level[]>([]);
  loadingLevels = signal(false);

  name = signal('');
  code = signal('');
  board = signal<Board | null>(null);
  selectedLevelIds = signal<string[]>([]);

  saving = signal(false);

  /** Submit disabled until every required field is filled — name, code,
   *  board, and at least one offered level (spec requirement). */
  canSubmit = computed(() =>
    this.name().trim().length > 0 &&
    this.code().trim().length > 0 &&
    this.board() !== null &&
    this.selectedLevelIds().length > 0 &&
    !this.saving(),
  );

  constructor(private academicsStaffService: AcademicsStaffService) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Reset + reload every time the dialog opens, same as
    // ManageBatchDialogComponent — covers reopening after a prior
    // create/cancel without stale state lingering.
    if (changes['visible'] && this.visible) {
      this.resetForm();
      this.loadLevels();
    }
  }

  private resetForm(): void {
    this.name.set('');
    this.code.set('');
    this.board.set(null);
    this.selectedLevelIds.set([]);
    this.saving.set(false);
  }

  private loadLevels(): void {
    this.loadingLevels.set(true);
    this.academicsStaffService.getLevels().subscribe({
      next: (levels) => {
        this.levels.set(levels);
        this.loadingLevels.set(false);
      },
      error: () => this.loadingLevels.set(false),
    });
  }

  toggleLevel(levelId: string, checked: boolean): void {
    const current = new Set(this.selectedLevelIds());
    if (checked) {
      current.add(levelId);
    } else {
      current.delete(levelId);
    }
    this.selectedLevelIds.set([...current]);
  }

  isLevelSelected(levelId: string): boolean {
    return this.selectedLevelIds().includes(levelId);
  }

  submit(): void {
    const board = this.board();
    if (!this.canSubmit() || !board) return;

    this.saving.set(true);
    this.academicsStaffService.createSubject({
      name: this.name().trim(),
      code: this.code().trim(),
      board,
      level_ids: this.selectedLevelIds(),
    }).subscribe({
      next: (subject) => {
        this.saving.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Subject Added',
          text: `${subject.name} (${subject.code}) has been added to the catalog.`,
          confirmButtonColor: '#101d3c',
          timer: 2000,
          timerProgressBar: true,
        });
        this.saved.emit(subject);
        this.closed.emit();
      },
      error: (err) => {
        this.saving.set(false);
        // Backend returns 400 with this exact detail on a case-insensitive
        // name/code collision (see create_subject in routers/academic.py).
        if (err?.status === 400) {
          Swal.fire({
            icon: 'warning',
            title: 'Subject Already Exists!',
            text: err?.error?.detail ?? 'A subject with this name or code already exists in the catalog.',
          });
          return;
        }
        Swal.fire({
          icon: 'error',
          title: 'Could not add subject',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  cancel(): void {
    this.closed.emit();
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }
}
