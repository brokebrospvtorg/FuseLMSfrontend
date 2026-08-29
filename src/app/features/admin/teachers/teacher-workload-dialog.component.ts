import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import { TeacherWorkloadSummary } from '../../../core/models/teacher.model';

/**
 * Teacher Workload drawer — the clickable Teacher row's inline detail
 * view: the exact batches/subjects they're currently teaching. Levels
 * are deliberately not shown on this screen (Teachers view spec) even
 * though TeacherWorkloadSummary.levels is still present on the input —
 * see this component's `teacher` Input type — the backend keeps
 * returning it, this drawer just never reads it.
 *
 * Presentational only, same split as BatchSummaryDialogComponent: the
 * parent (AdminTeachersComponent) owns the open/selected-teacher state.
 * Unlike the Batch Summary drawer, there's no separate loading/error
 * state here — GET /api/teachers/workload-summary already returns full
 * per-teacher detail up front, so opening a row just renders data
 * that's already in memory.
 *
 * Rendered as a right-side slide-over via p-dialog's `position="right"`,
 * same convention as batch-summary-dialog.component.ts.
 */
@Component({
  selector: 'app-teacher-workload-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, TagModule],
  templateUrl: './teacher-workload-dialog.component.html',
  styleUrl: './teacher-workload-dialog.component.scss',
})
export class TeacherWorkloadDialogComponent {
  @Input() visible = false;
  @Input() teacher: TeacherWorkloadSummary | null = null;

  @Output() closed = new EventEmitter<void>();

  /** Assignments grouped by subject — "Mathematics: May/June 2026, Oct/Nov
   *  2026" reads better than one flat row per subject+batch pair when a
   *  teacher has the same subject across several batches. */
  get assignmentsBySubject(): { subject_name: string; batch_names: string[] }[] {
    const teacher = this.teacher;
    if (!teacher) return [];

    const order: string[] = [];
    const bySubject = new Map<string, string[]>();
    for (const a of teacher.assignments) {
      if (!bySubject.has(a.subject_name)) {
        bySubject.set(a.subject_name, []);
        order.push(a.subject_name);
      }
      bySubject.get(a.subject_name)!.push(a.batch_name);
    }
    return order.map((subject_name) => ({ subject_name, batch_names: bySubject.get(subject_name)! }));
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }
}
