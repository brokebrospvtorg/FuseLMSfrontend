import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { TeachingScheduleEntry } from '../../../core/models/academic.model';

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};

/**
 * Sub-Sprint 6.1 — Timetable Screen.
 * Backend: GET /api/timetable/my-teaching-schedule (app/routers/timetable.py) —
 * every TimetableSlot where this Teacher is the assigned teacher_id, across
 * all subjects/batches. Coordinator-assigned; this screen is read-only.
 *
 * NOTE: no room numbers shown, same as the Parent Timetable screen —
 * timetable_slots has no room column in the schema (models/attendance.py).
 * Saturday included since DayOfWeek (models/enums.py) allows it, even
 * though the Coordinator's Timetable Builder may not always use it.
 */
@Component({
  selector: 'app-teacher-timetable',
  standalone: true,
  imports: [CommonModule, CardModule, TagModule, ProgressSpinnerModule, MessageModule],
  templateUrl: './teacher-timetable.component.html',
  styleUrl: './teacher-timetable.component.scss',
})
export class TeacherTimetableComponent implements OnInit {
  private staffService = inject(AcademicsStaffService);

  schedule = signal<TeachingScheduleEntry[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  weekDays = WEEK_DAYS;
  dayLabels = DAY_LABELS;
  today = WEEK_DAYS[new Date().getDay() - 1] ?? null; // getDay(): 0=Sun..6=Sat; null on Sunday (no highlight)

  /** Grouped + period-sorted per day, so the template just loops. Days with
   *  no periods scheduled still render (empty state per column) rather than
   *  collapsing the grid, so the weekly shape stays visually consistent. */
  scheduleByDay = computed<Record<string, TeachingScheduleEntry[]>>(() => {
    const grouped: Record<string, TeachingScheduleEntry[]> = {};
    for (const day of WEEK_DAYS) grouped[day] = [];
    for (const entry of this.schedule()) {
      if (grouped[entry.day_of_week]) {
        grouped[entry.day_of_week].push(entry);
      }
    }
    for (const day of WEEK_DAYS) {
      grouped[day].sort((a, b) => a.period_number - b.period_number);
    }
    return grouped;
  });

  ngOnInit(): void {
    this.staffService.getMyTeachingSchedule().subscribe({
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
}
