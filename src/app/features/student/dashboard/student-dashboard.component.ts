import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AcademicService } from '../../../core/services/academic.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { UserService } from '../../../core/services/user.service';
import { DashboardSummary, TimetableEntry } from '../../../core/models/academic.model';
import { AttendanceSummary } from '../../../core/models/attendance.model';
import { MyProfile } from '../../../core/models/user.model';
import { getLevelAbbreviation } from '../../../shared/utils/level-badge.util';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-dashboard.component.html',
})
export class StudentDashboardComponent implements OnInit {
  private academicService = inject(AcademicService);
  private attendanceService = inject(AttendanceService);
  private userService = inject(UserService);

  profile = signal<MyProfile | null>(null);
  summary = signal<DashboardSummary | null>(null);
  timetable = signal<TimetableEntry[]>([]);
  attendanceBySubject = signal<AttendanceSummary[]>([]);
  loading = signal(true);

  todaysClasses = computed(() => {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return this.timetable().filter((t) => t.day_of_week.toLowerCase() === todayName);
  });

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (data) => this.profile.set(data),
      error: () => {
        /* profile card falls back to placeholders — not critical enough to block the page */
      },
    });

    this.academicService.getDashboardSummary().subscribe({
      next: (data) => this.summary.set(data),
      error: () => {},
    });

    this.academicService.getMyTimetable().subscribe({
      next: (data) => {
        this.timetable.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.attendanceService.getMyAttendanceSummary().subscribe({
      next: (data) => this.attendanceBySubject.set(data.slice(0, 4)),
      error: () => {},
    });
  }

  attendanceColor(pct: number): string {
    if (pct >= 85) return 'text-emerald-600';
    if (pct >= 75) return 'text-amber-600';
    return 'text-rose-600';
  }

  /** Short level badge ("OL" / "AS" / "A2" / "Composite") for a DB level
   *  code, or null when there's nothing to show. */
  levelBadge(levelCode: string | null): string | null {
    return getLevelAbbreviation(levelCode);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
