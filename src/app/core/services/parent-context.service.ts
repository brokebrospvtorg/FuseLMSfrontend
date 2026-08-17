import { Injectable, computed, signal } from '@angular/core';

import { ParentService } from './parent.service';
import { ParentChild } from '../models/parent.model';

const SELECTED_CHILD_STORAGE_KEY = 'fuse.parent.selectedChildId';

/**
 * Shared "which child is currently selected" state across the whole Parent
 * portal. Didn't exist before this sub-sprint — ParentDashboardComponent
 * used to own this as its own local signals, which meant switching to
 * another tab (Attendance, Timetable, etc.) would lose the selection.
 * Every parent page now reads/writes through this instead.
 *
 * Selection is persisted to sessionStorage so a page refresh doesn't fall
 * back to the first child every time.
 */
@Injectable({ providedIn: 'root' })
export class ParentContextService {
  private readonly _children = signal<ParentChild[]>([]);
  private readonly _selectedStudentId = signal<string | null>(null);
  private readonly _loading = signal(true);
  private readonly _error = signal<string | null>(null);
  private hasLoaded = false;

  readonly children = this._children.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedStudentId = this._selectedStudentId.asReadonly();

  readonly selectedChild = computed<ParentChild | null>(
    () => this._children().find((c) => c.student_id === this._selectedStudentId()) ?? null,
  );

  constructor(private parentService: ParentService) {}

  /**
   * Safe to call from every parent page's ngOnInit — only actually fetches
   * once per session; subsequent calls are no-ops so navigating between
   * Dashboard/Attendance/Timetable doesn't re-fetch the children list.
   */
  ensureLoaded(): void {
    if (this.hasLoaded) return;
    this.hasLoaded = true;
    this._loading.set(true);

    this.parentService.getMyChildren().subscribe({
      next: (children) => {
        this._children.set(children);
        this._loading.set(false);

        const storedId = sessionStorage.getItem(SELECTED_CHILD_STORAGE_KEY);
        const initial =
          children.find((c) => c.student_id === storedId)?.student_id ?? children[0]?.student_id ?? null;
        if (initial) {
          this._selectedStudentId.set(initial);
        }
      },
      error: () => {
        this._loading.set(false);
        this._error.set('Could not load your linked children right now.');
      },
    });
  }

  selectChild(studentId: string): void {
    this._selectedStudentId.set(studentId);
    sessionStorage.setItem(SELECTED_CHILD_STORAGE_KEY, studentId);
  }
}
