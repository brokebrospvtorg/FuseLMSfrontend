import { Component, OnInit, effect, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ParentService } from '../../../core/services/parent.service';
import { ParentContextService } from '../../../core/services/parent-context.service';
import { ParentChild, ParentTimetableEntry } from '../../../core/models/parent.model';

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday',
};

/**
 * Sub-Sprint 1 — Timetable View.
 * Backend: GET /api/parent/child/{id}/timetable (app/routers/parent.py).
 * NOTE: no room numbers shown — timetable_slots has no room column in the
 * schema (models/attendance.py). Flagging rather than inventing one.
 */
@Component({
  selector: 'app-parent-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, SelectModule, ProgressSpinnerModule, MessageModule],
  templateUrl: './parent-timetable.component.html',
  styleUrl: './parent-timetable.component.scss',
})
export class ParentTimetableComponent implements OnInit {
  // Services ko pehle inject kar lo
  private parentService = inject(ParentService);
  private context = inject(ParentContextService);

  // Property initializers ab `this.context` ko safely access kar sakte hain
  children = this.context.children;
  childrenLoading = this.context.loading;
  childrenError = this.context.error;
  selectedChild = this.context.selectedChild;

  entries = signal<ParentTimetableEntry[]>([]);
  entriesLoading = signal(false);
  entriesError = signal<string | null>(null);

  weekDays = WEEK_DAYS;
  dayLabels = DAY_LABELS;
  today = WEEK_DAYS[new Date().getDay() - 1] ?? null; // getDay(): 0=Sun..6=Sat; null on Sat/Sun (no highlight)

  /** Grouped + time-sorted per day, so the template just loops without re-deriving on every change-detection pass. */
  entriesByDay = computed<Record<string, ParentTimetableEntry[]>>(() => {
    const grouped: Record<string, ParentTimetableEntry[]> = {};
    for (const day of WEEK_DAYS) grouped[day] = [];
    for (const entry of this.entries()) {
      if (grouped[entry.day_of_week]) {
        grouped[entry.day_of_week].push(entry);
      }
    }
    for (const day of WEEK_DAYS) {
      grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return grouped;
  });

  constructor() {
    effect(() => {
      const child = this.context.selectedChild();
      if (child) {
        this.loadTimetable(child.student_id);
      } else {
        this.entries.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.context.ensureLoaded();
  }

  onChildChange(child: ParentChild): void {
    this.context.selectChild(child.student_id);
  }

  private loadTimetable(studentId: string): void {
    this.entriesLoading.set(true);
    this.entriesError.set(null);
    this.parentService.getChildTimetable(studentId).subscribe({
      next: (data) => {
        this.entries.set(data);
        this.entriesLoading.set(false);
      },
      error: () => {
        this.entriesLoading.set(false);
        this.entriesError.set('Could not load the timetable for this child right now.');
      },
    });
  }
}