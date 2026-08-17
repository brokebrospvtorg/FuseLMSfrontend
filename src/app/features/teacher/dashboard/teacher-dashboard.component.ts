import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AuthService } from '../../../core/services/auth.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { TeacherAssignment, MarkEditRequestFull } from '../../../core/models/academics-staff.model';
import { TeachingScheduleEntry } from '../../../core/models/academic.model';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ProgressSpinnerModule],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.scss',
})
export class TeacherDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private academicsStaffService = inject(AcademicsStaffService);

  loading = signal(true);
  assignments = signal<TeacherAssignment[]>([]);
  schedule = signal<TeachingScheduleEntry[]>([]);
  editRequests = signal<MarkEditRequestFull[]>([]);

  pendingEditRequestsCount = computed(
    () => this.editRequests().filter((r) => r.status === 'pending').length,
  );

  get teacherName(): string {
    return this.authService.currentUser()?.full_name ?? 'Teacher';
  }

  /** "Assigned Classes" = distinct subject+batch pairs, not just distinct
   *  subjects — teaching the same subject to two different batches counts
   *  as two classes, which matches how the timetable/roster actually work. */
  assignedClassesCount = computed(() => {
    const seen = new Set(this.assignments().map((a) => `${a.subject_id}:${a.batch_id}`));
    return seen.size;
  });

  todaysLectures = computed(() => {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return this.schedule()
      .filter((s) => s.day_of_week.toLowerCase() === todayName)
      .sort((a, b) => a.period_number - b.period_number);
  });

  ngOnInit(): void {
    this.academicsStaffService.getMyTeacherAssignments().subscribe({
      next: (data) => {
        this.assignments.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.academicsStaffService.getMyTeachingSchedule().subscribe({
      next: (data) => this.schedule.set(data),
      error: () => {
        /* schedule card just shows 0 — not critical enough to block the page */
      },
    });

    this.academicsStaffService.getMyMarkEditRequests().subscribe({
      next: (data) => this.editRequests.set(data),
      error: () => {
        /* stat just shows 0 — not critical enough to block the page */
      },
    });
  }
}
