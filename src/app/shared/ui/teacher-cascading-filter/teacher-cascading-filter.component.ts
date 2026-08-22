import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';

import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { Batch, Subject, Level } from '../../../core/models/academic.model';
import { Board } from '../../../core/models/enums';
import { BOARD_OPTIONS } from '../../utils/board-options.util';
import { CascadingSelect } from '../../utils/cascading-select';

/** One (subject, batch, board) combination a teacher is actually permitted
 *  to act on — the authorization guard for every stage of the cascade
 *  below. Built by the caller from whatever "my own" list it already has:
 *  TeacherAssignment[] for the Marks screen, TeacherTimetableSlot[] for
 *  Attendance. Nothing in this component ever widens past this set — the
 *  catalog-wide Subject/Batch lists passed in via `subjects`/`batches` are
 *  only used to resolve names/labels for the pairs in this list.
 *
 *  `board` is REQUIRED and is the authoritative source for every board
 *  option this component ever shows — it comes straight from the backend
 *  (GET /academic/teacher-assignments / GET /timetable/slots), which
 *  resolves it from the batch's actual active `batch_subjects` offering,
 *  not from the catalog Subject's own `board` field (which can be "All").
 *  See those endpoints' docstrings for why this distinction matters: an
 *  "All Boards" catalog Subject used to make every board show up for
 *  every batch a teacher touched it in, regardless of which board(s) were
 *  actually offered+active there. */
export interface TeacherFilterPair {
  subjectId: string;
  batchId: string;
  board: Board;
}

export interface TeacherFilterOption<TData = unknown> {
  label: string;
  value: string;
  data?: TData;
}

/** Emitted once every stage up to (and, when enabled, including) the
 *  Period/Class stage has a value. Never emitted partially — see
 *  `selectionChange` below. */
export interface TeacherFilterSelection<TPeriod = unknown> {
  batch: Batch;
  board: Board;
  levelId: string;
  levelName: string;
  subject: Subject;
  /** null only when `periodsEnabled` is false (the chain terminates at Subject). */
  period: TeacherFilterOption<TPeriod> | null;
}

/** What's known once a Subject is picked, independent of whether a
 *  Period/Class stage exists at all — this is what Marks entry needs to
 *  start loading assessments; Attendance additionally waits for a period. */
export interface TeacherFilterSubjectContext {
  batch: Batch;
  board: Board;
  levelId: string;
  levelName: string;
  subject: Subject;
}

/**
 * Reusable Batch -> Board -> Level -> Subject -> Period/Class cascading
 * filter for the Teacher Portal's Attendance and Marks-entry screens.
 *
 * Every stage's *options* are computed synchronously from the catalog data
 * the parent already loads on init (`batches`, `subjects`) intersected
 * against `allowedPairs` — this component never widens what a Teacher can
 * pick beyond subject/batch combinations they're actually assigned to. The
 * only real async step is the final Period/Class stage, whose fetch
 * function is supplied by the caller via `loadPeriods` since "what a
 * period is" differs between screens (a day's TeacherTimetableSlot for
 * Attendance vs. a Class/Batch confirmation for Marks, which has no
 * per-day slots at all).
 *
 * Selecting a parent stage always clears every stage below it and re-runs
 * that child's fetch (or clears it, if the new parent value is null) —
 * each stage is backed by shared/utils/cascading-select.ts's
 * CascadingSelect, the same "auto-reset + disabled-until-parent-picked +
 * loading flag" primitive already used elsewhere in the app (see that
 * file's docstring), so this component follows the same signals-based
 * pattern as the rest of the codebase rather than introducing
 * ReactiveFormsModule.
 *
 * Usage (Attendance — Period stage enabled):
 *   <app-teacher-cascading-filter
 *     [batches]="batches()" [subjects]="subjects()" [levels]="levels()"
 *     [allowedPairs]="allowedPairs()"
 *     periodLabel="Period"
 *     [loadPeriods]="loadTodaysPeriods"
 *     (selectionChange)="onSelectionChange($event)">
 *   </app-teacher-cascading-filter>
 *
 * Usage (Marks entry — no per-day periods, chain ends at Subject):
 *   <app-teacher-cascading-filter
 *     [batches]="batches()" [subjects]="subjects()" [levels]="levels()"
 *     [allowedPairs]="allowedPairs()"
 *     [periodsEnabled]="false"
 *     (subjectChange)="onSubjectChange($event)">
 *   </app-teacher-cascading-filter>
 */
@Component({
  selector: 'app-teacher-cascading-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, ProgressSpinnerModule],
  templateUrl: './teacher-cascading-filter.component.html',
  styleUrl: './teacher-cascading-filter.component.scss',
})
export class TeacherCascadingFilterComponent<TPeriod = unknown> implements OnChanges {
  // --- Catalog data + authorization guard, supplied by the parent ---
  @Input({ required: true }) batches: Batch[] = [];
  @Input({ required: true }) subjects: Subject[] = [];
  /** Optional — only used to resolve a display name for a level whose
   *  Subject didn't already carry `level_name`. Safe to omit. */
  @Input() levels: Level[] = [];
  @Input({ required: true }) allowedPairs: TeacherFilterPair[] = [];

  // --- Final stage configuration ---
  /** When false, the chain terminates at Subject — `selectionChange`
   *  fires as soon as a Subject is picked, with `period` always null, and
   *  no Period/Class dropdown is rendered at all. */
  @Input() periodsEnabled = true;
  @Input() periodLabel = 'Period';
  @Input() periodPlaceholder = 'Select a period';
  /** Required when `periodsEnabled` is true. Called with the fully
   *  resolved Batch/Board/Level/Subject context every time Subject
   *  changes; return the Period/Class options for that combination. */
  @Input() loadPeriods: ((ctx: TeacherFilterSubjectContext) => Observable<TeacherFilterOption<TPeriod>[]>) | null =
    null;

  @Input() batchLabel = 'Batch';
  @Input() boardLabel = 'Board';
  @Input() levelLabel = 'Level';
  @Input() subjectLabel = 'Subject';

  /** Fires on every Subject change (including back to null), independent
   *  of the Period/Class stage — this is what a screen with no periods
   *  (Marks entry) should key off of. */
  @Output() subjectChange = new EventEmitter<TeacherFilterSubjectContext | null>();

  /** Fires whenever the full selection is complete (or stops being
   *  complete). Never partial: with `periodsEnabled` true this only fires
   *  once a Period/Class is also picked; with it false, as soon as
   *  Subject is picked (mirrors `subjectChange` in that case). */
  @Output() selectionChange = new EventEmitter<TeacherFilterSelection<TPeriod> | null>();

  // --- Current selection at each stage ---
  selectedBatchId = signal<string | null>(null);
  selectedBoard = signal<Board | null>(null);
  selectedLevelId = signal<string | null>(null);
  selectedSubjectId = signal<string | null>(null);
  selectedPeriodValue = signal<string | null>(null);

  // --- Stage 1: Batch — options are just the catalog batches this
  // teacher has at least one allowed pair in, no async fetch needed.
  //
  // BUG FIX: this was previously `computed(() => ...)`. computed() only
  // re-runs when an actual Angular signal it read changes — `this.batches`
  // and `this.allowedPairs` are plain @Input() properties, not signals,
  // so reading them inside computed() creates no reactive dependency at
  // all. The result: this evaluated ONCE (on whatever batches/allowedPairs
  // happened to be at the very first read) and permanently cached that
  // forever, never recomputing when the real @Input values arrived later.
  // Harmless for an instance created only after data has already loaded
  // (the search filter bar, gated behind an @else block) — but this
  // component ALSO gets instantiated by <p-dialog>'s projected content at
  // initial page load (PrimeNG keeps dialog content in the DOM, hidden via
  // CSS, rather than deferring creation until visible=true), at which
  // point batches/allowedPairs are still their empty starting arrays. That
  // instance cached [] forever and never saw the real data arrive.
  // A plain method re-evaluates on every change-detection cycle instead of
  // memoizing, so it always reflects the current @Input values with no
  // staleness risk — safe here since this component has no OnPush strategy.
  batchOptions(): TeacherFilterOption<Batch>[] {
    const allowedBatchIds = new Set(this.allowedPairs.map((p) => p.batchId));
    return this.batches
      .filter((b) => allowedBatchIds.has(b.id))
      .map((b) => ({ label: b.name, value: b.id, data: b }));
  }

  // --- Stage 2: Board (depends on Batch) ---
  readonly boards = new CascadingSelect<string, TeacherFilterOption<Board>>((batchId) =>
    of(this.computeBoardOptions(batchId)),
  );

  // --- Stage 3: Level (depends on Batch + Board) ---
  readonly levelsSel = new CascadingSelect<{ batchId: string; board: Board }, TeacherFilterOption<Level | null>>(
    (ctx) => of(this.computeLevelOptions(ctx.batchId, ctx.board)),
  );

  // --- Stage 4: Subject (depends on Batch + Board + Level) ---
  readonly subjectsSel = new CascadingSelect<
    { batchId: string; board: Board; levelId: string },
    TeacherFilterOption<Subject>
  >((ctx) => of(this.computeSubjectOptions(ctx.batchId, ctx.board, ctx.levelId)));

  // --- Stage 5: Period/Class (depends on the full context; caller-supplied) ---
  readonly periods = new CascadingSelect<TeacherFilterSubjectContext, TeacherFilterOption<TPeriod>>((ctx) => {
    if (!this.periodsEnabled || !this.loadPeriods) return of([]);
    return this.loadPeriods(ctx);
  });

  ngOnChanges(changes: SimpleChanges): void {
    // If the parent swaps in a different allowed-pairs/catalog set out from
    // under an in-progress selection (e.g. re-opening this screen for a
    // different day/context), don't leave a now-invalid selection sitting
    // in a downstream dropdown — collapse back to the top of the chain.
    if (changes['allowedPairs'] || changes['batches'] || changes['subjects']) {
      this.onBatchChange(null);
    }
  }

  private computeBoardOptions(batchId: string | null): TeacherFilterOption<Board>[] {
    if (!batchId) return [];
    // Over-Inclusive Cascading Dropdowns fix: boards come straight off
    // allowedPairs (server-resolved from the batch's actual active
    // batch_subjects offering), never inferred from the catalog Subject's
    // own `board` field. Before this fix, a Subject catalogued as "All
    // Boards" made every board show up here for every batch a teacher was
    // assigned/scheduled in, even batches where only one board's offering
    // was actually active — or none at all.
    const boardsPresent = new Set<Board>(
      this.allowedPairs.filter((p) => p.batchId === batchId).map((p) => p.board),
    );
    return BOARD_OPTIONS.filter((opt) => boardsPresent.has(opt.value)).map((opt) => ({
      label: opt.label,
      value: opt.value,
      data: opt.value,
    }));
  }

  private computeLevelOptions(batchId: string, board: Board): TeacherFilterOption<Level | null>[] {
    const allowedSubjectIds = new Set(
      this.allowedPairs
        .filter((p) => p.batchId === batchId && p.board === board)
        .map((p) => p.subjectId),
    );
    const levelsById = new Map(this.levels.map((l) => [l.id, l]));
    const seen = new Map<string, TeacherFilterOption<Level | null>>();
    for (const s of this.subjects) {
      if (!allowedSubjectIds.has(s.id)) continue;
      if (seen.has(s.level_id)) continue;
      const level = levelsById.get(s.level_id) ?? null;
      seen.set(s.level_id, {
        label: s.level_name ?? level?.name ?? 'Unnamed level',
        value: s.level_id,
        data: level,
      });
    }
    // Stable, human-friendly ordering by the shared Level catalog's own
    // display_order where we have it; unknown levels sort after known ones.
    return [...seen.values()].sort((a, b) => {
      const orderA = a.data?.display_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.data?.display_order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a.label.localeCompare(b.label);
    });
  }

  private computeSubjectOptions(batchId: string, board: Board, levelId: string): TeacherFilterOption<Subject>[] {
    const allowedSubjectIds = new Set(
      this.allowedPairs
        .filter((p) => p.batchId === batchId && p.board === board)
        .map((p) => p.subjectId),
    );
    return this.subjects
      .filter((s) => s.level_id === levelId && allowedSubjectIds.has(s.id))
      .map((s) => ({ label: s.name, value: s.id, data: s }));
  }

  // -------------------------------------------------------------------
  // Change handlers — each one resets every stage below it, per the
  // "auto-reset child selections on parent change" requirement.
  // -------------------------------------------------------------------

  onBatchChange(batchId: string | null): void {
    this.selectedBatchId.set(batchId);
    this.selectedBoard.set(null);
    this.selectedLevelId.set(null);
    this.selectedSubjectId.set(null);
    this.selectedPeriodValue.set(null);

    this.boards.loadFor(batchId);
    this.levelsSel.reset();
    this.subjectsSel.reset();
    this.periods.reset();

    this.emitSubjectChange();
    this.emitSelectionChange();
  }

  onBoardChange(board: Board | null): void {
    this.selectedBoard.set(board);
    this.selectedLevelId.set(null);
    this.selectedSubjectId.set(null);
    this.selectedPeriodValue.set(null);

    const batchId = this.selectedBatchId();
    this.levelsSel.loadFor(batchId && board ? { batchId, board } : null);
    this.subjectsSel.reset();
    this.periods.reset();

    this.emitSubjectChange();
    this.emitSelectionChange();
  }

  onLevelChange(levelId: string | null): void {
    this.selectedLevelId.set(levelId);
    this.selectedSubjectId.set(null);
    this.selectedPeriodValue.set(null);

    const batchId = this.selectedBatchId();
    const board = this.selectedBoard();
    this.subjectsSel.loadFor(batchId && board && levelId ? { batchId, board, levelId } : null);
    this.periods.reset();

    this.emitSubjectChange();
    this.emitSelectionChange();
  }

  onSubjectChange(subjectId: string | null): void {
    this.selectedSubjectId.set(subjectId);
    this.selectedPeriodValue.set(null);

    const ctx = this.currentSubjectContext(subjectId);
    if (this.periodsEnabled) {
      this.periods.loadFor(ctx);
    } else {
      this.periods.reset();
    }

    this.subjectChange.emit(ctx);
    this.emitSelectionChange();
  }

  onPeriodChange(periodValue: string | null): void {
    this.selectedPeriodValue.set(periodValue);
    this.emitSelectionChange();
  }

  private currentSubjectContext(subjectId: string | null): TeacherFilterSubjectContext | null {
    const batchId = this.selectedBatchId();
    const board = this.selectedBoard();
    const levelId = this.selectedLevelId();
    if (!batchId || !board || !levelId || !subjectId) return null;

    const batch = this.batches.find((b) => b.id === batchId);
    const subject = this.subjectsSel.options().find((o) => o.value === subjectId)?.data;
    const levelOption = this.levelsSel.options().find((o) => o.value === levelId);
    if (!batch || !subject) return null;

    return {
      batch,
      board,
      levelId,
      levelName: levelOption?.label ?? '',
      subject,
    };
  }

  private emitSubjectChange(): void {
    this.subjectChange.emit(this.currentSubjectContext(this.selectedSubjectId()));
  }

  private emitSelectionChange(): void {
    const ctx = this.currentSubjectContext(this.selectedSubjectId());
    if (!ctx) {
      this.selectionChange.emit(null);
      return;
    }
    if (!this.periodsEnabled) {
      this.selectionChange.emit({ ...ctx, period: null });
      return;
    }
    const periodValue = this.selectedPeriodValue();
    const period = periodValue ? this.periods.options().find((o) => o.value === periodValue) ?? null : null;
    if (!period) {
      this.selectionChange.emit(null);
      return;
    }
    this.selectionChange.emit({ ...ctx, period });
  }

  /**
   * Programmatically drives the whole cascade to a specific
   * (batch, board, subject[, period]) combination — used for deep-linking,
   * e.g. from the Teacher Timetable's "Mark Attendance" button straight
   * into a specific slot's roster instead of making the teacher re-pick
   * every stage by hand.
   *
   * Deliberately does NOT call onBatchChange()/onBoardChange()/etc. — each
   * of those kicks off its OWN loadFor(), which would double-fetch here
   * (harmless in practice since Board/Level/Subject resolve synchronously
   * via of(...), but wasteful, and would double-emit intermediate null
   * selectionChange events along the way). Instead this chains
   * loadFor(..., onLoaded) once per stage — the same "populate parent, set
   * child only once its options have actually loaded" pattern
   * CascadingSelect's own docstring describes for edit/patch mode,
   * applied at every stage instead of just one. The final Period stage
   * (Attendance's real per-day slots) genuinely is async — this is why
   * the whole chain has to be callback-based rather than four sequential
   * synchronous calls.
   *
   * If subjectId isn't in `subjects`, or the resolved combination isn't
   * actually in `allowedPairs`, this silently does nothing — the caller
   * (e.g. a deep link with a stale/tampered query param) gets left with
   * the cascade exactly as it was, not landed in some half-set,
   * inconsistent state. Use hasSelection() after calling this to know
   * whether it actually landed.
   */
  applyDeepLink(target: { batchId: string; subjectId: string; board: Board; periodValue?: string | null }): void {
    const subject = this.subjects.find((s) => s.id === target.subjectId);
    const isAllowed = this.allowedPairs.some(
      (p) => p.batchId === target.batchId && p.subjectId === target.subjectId && p.board === target.board,
    );
    if (!subject || !isAllowed) return;

    this.selectedBatchId.set(target.batchId);
    this.selectedBoard.set(null);
    this.selectedLevelId.set(null);
    this.selectedSubjectId.set(null);
    this.selectedPeriodValue.set(null);

    this.boards.loadFor(target.batchId, () => {
      this.selectedBoard.set(target.board);

      this.levelsSel.loadFor({ batchId: target.batchId, board: target.board }, () => {
        this.selectedLevelId.set(subject.level_id);

        this.subjectsSel.loadFor(
          { batchId: target.batchId, board: target.board, levelId: subject.level_id },
          () => {
            this.selectedSubjectId.set(target.subjectId);
            this.emitSubjectChange();

            const ctx = this.currentSubjectContext(target.subjectId);
            if (this.periodsEnabled && ctx) {
              this.periods.loadFor(ctx, (periodOptions) => {
                const match = target.periodValue
                  ? periodOptions.find((o) => o.value === target.periodValue)
                  : undefined;
                if (match) this.selectedPeriodValue.set(match.value);
                this.emitSelectionChange();
              });
            } else {
              this.emitSelectionChange();
            }
          },
        );
      });
    });
  }

  /** True once every enabled stage has a value — lets a caller (e.g. the
   *  Attendance screen, after calling applyDeepLink()) know whether the
   *  deep link actually landed fully, without duplicating the
   *  periodsEnabled branching itself. */
  hasSelection(): boolean {
    return (
      this.selectedBatchId() !== null &&
      this.selectedBoard() !== null &&
      this.selectedLevelId() !== null &&
      this.selectedSubjectId() !== null &&
      (!this.periodsEnabled || this.selectedPeriodValue() !== null)
    );
  }

  /** Public reset — lets a parent screen collapse the whole cascade back
   *  to "nothing picked" (e.g. after a successful submit that should send
   *  the teacher back to the top of the chain). */
  reset(): void {
    this.onBatchChange(null);
  }
}
