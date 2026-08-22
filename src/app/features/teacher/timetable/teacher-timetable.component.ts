import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { TeachingScheduleEntry } from '../../../core/models/academic.model';
import { BOARD_OPTIONS } from '../../../shared/utils/board-options.util';

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
type WeekDay = (typeof WEEK_DAYS)[number];
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};
const DAY_LABELS_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
};

/**
 * Timetable screen — "Today's Classes" quick-attendance flow.
 * Backend: GET /api/timetable/my-teaching-schedule (app/routers/timetable.py),
 * now with an optional day_of_week filter this screen's day-pill bar drives.
 *
 * Design choice: the day-pill bar SERVER-filters (getMyTeachingSchedule(day))
 * rather than fetching the whole week once and filtering client-side —
 * matches the backend's own reasoning for adding the param (see its
 * docstring) and means a day tab always reflects a real request, not a
 * client-side view of data that may have gone stale since the initial load.
 *
 * "Mark Attendance" only ever appears on a TODAY row. The marking screen
 * (TeacherAttendanceComponent) is hard-locked to today's date by design
 * (Sub-Sprint 3.3 — "Strict current-date Day-Wise UI") — a button on a
 * Tuesday's card when today is Monday would deep-link into a screen that
 * can't actually do anything with that period, so it's simply not shown
 * there at all rather than shown-and-broken.
 *
 * No room numbers — timetable_slots has no room column in the schema
 * (models/attendance.py), unchanged from before this rewrite.
 */
@Component({
  selector: 'app-teacher-timetable',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TagModule, ButtonModule,
    SelectModule, ProgressSpinnerModule, MessageModule,
  ],
  templateUrl: './teacher-timetable.component.html',
  styleUrl: './teacher-timetable.component.scss',
})
export class TeacherTimetableComponent implements OnInit {
  private staffService = inject(AcademicsStaffService);
  private router = inject(Router);

  weekDays = WEEK_DAYS;
  dayLabels = DAY_LABELS;
  dayLabelsShort = DAY_LABELS_SHORT;
  boardOptions = BOARD_OPTIONS;

  // getDay(): 0=Sun..6=Sat. Sunday isn't a WEEK_DAYS entry (matches the
  // Coordinator Timetable Builder's own Mon-Sat convention) — default to
  // 'all' on a Sunday rather than pointing the day-pill bar at a day it
  // doesn't have a tab for.
  readonly today: WeekDay | null = WEEK_DAYS[new Date().getDay() - 1] ?? null;

  /** 'all' = full week (grouped-by-day grid, the original layout);
   *  a specific day = flat chronological card list ("Today's Classes"
   *  when it happens to be today, "Monday's Classes" etc. otherwise). */
  selectedDay = signal<WeekDay | 'all'>(this.today ?? 'all');

  schedule = signal<TeachingScheduleEntry[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // --- Optional Batch/Subject filters (Task B: "Flexible Filter Controls") ---
  selectedBatchId = signal<string | null>(null);
  selectedSubjectId = signal<string | null>(null);

  batchOptions = computed(() => {
    const seen = new Map<string, string>();
    for (const e of this.schedule()) seen.set(e.batch_id, e.batch_name);
    return [...seen.entries()].map(([value, label]) => ({ label, value }));
  });
  subjectOptions = computed(() => {
    const seen = new Map<string, string>();
    for (const e of this.schedule()) seen.set(e.subject_id, e.subject_name);
    return [...seen.entries()].map(([value, label]) => ({ label, value }));
  });

  /** After the optional Batch/Subject filters, on top of whatever
   *  `schedule()` already holds (already day-filtered server-side by
   *  `selectedDay` — see loadSchedule). */
  filteredSchedule = computed(() => {
    const batchId = this.selectedBatchId();
    const subjectId = this.selectedSubjectId();
    return this.schedule().filter(
      (e) => (!batchId || e.batch_id === batchId) && (!subjectId || e.subject_id === subjectId),
    );
  });

  /** Grouped + period-sorted per day — only used in 'all' week-grid mode. */
  scheduleByDay = computed<Record<string, TeachingScheduleEntry[]>>(() => {
    const grouped: Record<string, TeachingScheduleEntry[]> = {};
    for (const day of WEEK_DAYS) grouped[day] = [];
    for (const entry of this.filteredSchedule()) {
      if (grouped[entry.day_of_week]) grouped[entry.day_of_week].push(entry);
    }
    for (const day of WEEK_DAYS) {
      grouped[day].sort((a, b) => this.toMinutes(a.start_time) - this.toMinutes(b.start_time));
    }
    return grouped;
  });

  /** Flat chronological list — used for a single selected day. */
  sortedSchedule = computed<TeachingScheduleEntry[]>(() =>
    [...this.filteredSchedule()].sort((a, b) => this.toMinutes(a.start_time) - this.toMinutes(b.start_time)),
  );

  ngOnInit(): void {
    this.loadSchedule();
  }

  onDayChanged(day: WeekDay | 'all'): void {
    this.selectedDay.set(day);
    this.loadSchedule();
  }

  private loadSchedule(): void {
    this.loading.set(true);
    this.error.set(null);
    const day = this.selectedDay();
    this.staffService.getMyTeachingSchedule(day === 'all' ? undefined : day).subscribe({
      next: (data) => {
        this.schedule.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load your timetable right now.');
      },
    });
  }

  boardLabel(board: string | null): string | null {
    return board ? (this.boardOptions.find((o) => o.value === board)?.label ?? board) : null;
  }

  /** \"HH:MM:SS\" / \"HH:MM\" -> minutes since midnight, for start_time ASC sorting. */
  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /** \"HH:MM:SS\" -> \"8:00 AM\", for the period badge. */
  formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  /** Task A.3/A.4 — only ever true for a row that's actually today, so the
   *  button is never offered on a card the marking screen can't handle. */
  isToday(entry: TeachingScheduleEntry): boolean {
    return entry.day_of_week === this.today;
  }

  markAttendance(entry: TeachingScheduleEntry): void {
    this.router.navigate(['/teacher/attendance'], {
      queryParams: {
        batch_id: entry.batch_id,
        subject_id: entry.subject_id,
        board: entry.board,
        slot_id: entry.id,
      },
    });
  }
}
