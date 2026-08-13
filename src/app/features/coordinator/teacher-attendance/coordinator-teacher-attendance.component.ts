import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AttendanceService } from '../../../core/services/attendance.service';
import { TeacherDailyStatusEntry } from '../../../core/models/attendance.model';
import { AttendanceStatus } from '../../../core/models/enums';

/**
 * Local row shape for the grid — status is a plain string here (not
 * AttendanceStatus | null like the API row) because p-selectButton needs
 * a concrete bindable value, and unselected has to be representable as
 * something other than one of the four real statuses.
 */
interface RegistryRow {
  teacher_user_id: string;
  full_name: string;
  period_count: number;
  status: AttendanceStatus | 'unset';
}

/**
 * Sub-Sprint 6.2 — Coordinator's Teacher Attendance Registry.
 * Backend: app/routers/attendance.py — GET /teachers/roster,
 * GET /teachers/daily-log, POST /teachers/daily-log.
 *
 * Two things worth knowing going in:
 * 1. There's no separate "teacher attendance" table — teachers and students
 *    share attendance_records, distinguished by user_id/role. A teacher's
 *    attendance is inherently per-period (tied to their timetable slots),
 *    so "one status per day" here means: apply that status to every period
 *    the teacher has on the chosen date, in one bulk call.
 * 2. The status enum is present/absent/late/excused — there's no "Leave"
 *    value in the DB (would need a migration). The UI's "Leave" toggle
 *    sends "excused" under the hood.
 */
@Component({
  selector: 'app-coordinator-teacher-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, DatePickerModule,
    SelectButtonModule, ButtonModule, TagModule, ProgressSpinnerModule,
  ],
  templateUrl: './coordinator-teacher-attendance.component.html',
  styleUrl: './coordinator-teacher-attendance.component.scss',
})
export class CoordinatorTeacherAttendanceComponent implements OnInit {
  statusOptions: { label: string; value: AttendanceStatus | 'unset' }[] = [
    { label: 'Present', value: AttendanceStatus.Present },
    { label: 'Absent', value: AttendanceStatus.Absent },
    { label: 'Leave', value: AttendanceStatus.Excused },
  ];

  selectedDate = signal<Date>(new Date());
  rows = signal<RegistryRow[]>([]);
  loading = signal(true);
  saving = signal(false);

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.loadLog();
  }

  onDateChanged(): void {
    this.loadLog();
  }

  private toIsoDate(d: Date): string {
    // Local calendar date, not UTC — a date-only picker converted via
    // toISOString() can roll back a day depending on timezone.
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadLog(): void {
    this.loading.set(true);
    this.attendanceService.getTeacherDailyLog(this.toIsoDate(this.selectedDate())).subscribe({
      next: (entries: TeacherDailyStatusEntry[]) => {
        this.rows.set(
          entries.map((e) => ({
            teacher_user_id: e.teacher_user_id,
            full_name: e.full_name,
            period_count: e.period_count,
            status: (e.status ?? 'unset') as AttendanceStatus | 'unset',
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        Swal.fire({ icon: 'error', title: 'Could not load teacher attendance', text: 'Please try again.' });
      },
    });
  }

  setStatus(row: RegistryRow, status: AttendanceStatus): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.teacher_user_id === row.teacher_user_id ? { ...r, status } : r)),
    );
  }

  saveDailyLog(): void {
    // Only teachers with a status actually chosen AND at least one period
    // that day get sent — the backend skips (and reports) anyone with zero
    // periods anyway, so filtering "unset" rows here just avoids no-op calls.
    const entries = this.rows()
      .filter((r) => r.status !== 'unset' && r.period_count > 0)
      .map((r) => ({ teacher_user_id: r.teacher_user_id, status: r.status as AttendanceStatus }));

    if (entries.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Nothing to save', text: 'Set a status for at least one teacher first.' });
      return;
    }

    this.saving.set(true);
    this.attendanceService
      .saveTeacherDailyLog({ date: this.toIsoDate(this.selectedDate()), entries })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          const skippedNote =
            result.skipped.length > 0
              ? ` ${result.skipped.length} teacher(s) had no periods that day and were skipped.`
              : '';
          Swal.fire({
            icon: 'success',
            title: 'Daily log saved',
            text: `${result.updated_teacher_ids.length} teacher(s) updated.${skippedNote}`,
            timer: 2800,
            showConfirmButton: false,
          });
          this.loadLog();
        },
        error: (err) => {
          this.saving.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not save the daily log',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
  }
}
