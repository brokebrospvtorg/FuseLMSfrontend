import { Signal, computed, signal } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Reusable "child dropdown depends on a parent value" helper.
 *
 * Why signals instead of ReactiveFormsModule/FormGroup:
 * --------------------------------------------------------
 * Every form already in this app — Coordinator's Timetable Builder,
 * Assignments & Marks, Teacher's Marks/Attendance, Admin's Registry —
 * uses plain signals + [ngModel] with manual onXChanged() handlers, not
 * ReactiveFormsModule. Introducing FormGroup/valueChanges here would mean
 * two competing form patterns side by side across the app, which is a
 * bigger and riskier change than the cascading behavior itself is worth.
 * This gets the same guarantees — auto-reset on parent change, disabled
 * until a parent is picked, a loading flag, and safe edit/patch-mode
 * population — using the pattern already everywhere in the codebase.
 *
 * Usage:
 *   readonly students = new CascadingSelect<string, RegistryUser>(
 *     (subjectId) => this.academicService.getStudentsForSubject(subjectId),
 *   );
 *
 *   onSubjectChanged(subjectId: string | null): void {
 *     this.formSubjectId.set(subjectId);
 *     this.formStudentId.set(null); // the child's own selection always resets
 *     this.students.loadFor(subjectId);
 *   }
 *
 *   // Edit/patch mode — populate the parent, then set the child's value
 *   // only once its options have actually loaded, so nothing gets wiped
 *   // out from under it mid-patch:
 *   this.students.loadFor(existing.subject_id, () => {
 *     this.formStudentId.set(existing.student_id);
 *   });
 *
 * Template:
 *   <p-select [options]="students.options()" [disabled]="students.disabled()"
 *             [placeholder]="students.disabled() ? 'Select a subject first' : 'Select a student'" ... />
 *   @if (students.loading()) { <p-progressSpinner ... /> }
 */
export class CascadingSelect<TParent, TOption> {
  private readonly _options = signal<TOption[]>([]);
  private readonly _loading = signal(false);
  private readonly _parentValue = signal<TParent | null>(null);

  readonly options: Signal<TOption[]> = this._options.asReadonly();
  readonly loading: Signal<boolean> = this._loading.asReadonly();
  /** True until a parent value is set — bind straight to the child control's [disabled]. */
  readonly disabled = computed(() => this._parentValue() === null);

  constructor(private fetchFn: (parentValue: TParent) => Observable<TOption[]>) {}

  /**
   * Call whenever the parent value changes. Clears the child's current
   * options and selection immediately — never leaves a stale list sitting
   * under a loading spinner — then fetches fresh ones for the new parent.
   * Pass null to just clear everything without fetching (parent was reset
   * to "nothing selected").
   *
   * onLoaded fires once the fetch resolves — that's the hook for edit/patch
   * mode: set the child's actual value only after this callback runs, so
   * the reset-on-parent-change above doesn't wipe out a value you're in
   * the middle of restoring.
   */
  loadFor(parentValue: TParent | null, onLoaded?: (options: TOption[]) => void): void {
    this._parentValue.set(parentValue);
    this._options.set([]);

    if (parentValue === null) {
      this._loading.set(false);
      return;
    }

    this._loading.set(true);
    this.fetchFn(parentValue).subscribe({
      next: (opts) => {
        this._options.set(opts);
        this._loading.set(false);
        onLoaded?.(opts);
      },
      error: () => {
        this._loading.set(false);
      },
    });
  }

  reset(): void {
    this._parentValue.set(null);
    this._options.set([]);
    this._loading.set(false);
  }
}
