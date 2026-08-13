import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AttendanceService } from '../../core/services/attendance.service';
import { AttendanceSummary, AttendanceRecord } from '../../core/models/attendance.model';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    TagModule,
    SelectModule,
    DatePickerModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  // --- Card grid (per-subject percentage breakdown) ---
  summary = signal<AttendanceSummary[]>([]);
  summaryLoading = signal(true);
  summaryError = signal<string | null>(null);

  // --- Detailed log, filterable by subject + date range ---
  records = signal<AttendanceRecord[]>([]);
  recordsLoading = signal(false);
  recordsError = signal<string | null>(null);

  filterSubjectId = signal<string | null>(null);
  filterDateFrom = signal<Date | null>(null);
  filterDateTo = signal<Date | null>(null);

  subjectOptions = computed(() =>
    this.summary().map((s) => ({ label: s.subject_name, value: s.subject_id })),
  );

  constructor(private attendanceService: AttendanceService) {}

  ngOnInit(): void {
    this.attendanceService.getMyAttendanceSummary().subscribe({
      next: (data) => {
        this.summary.set(data);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryError.set('Could not load attendance right now. Please try again shortly.');
        this.summaryLoading.set(false);
      },
    });

    this.loadRecords();
  }

  loadRecords(): void {
    this.recordsLoading.set(true);
    this.recordsError.set(null);

    const dateFrom = this.filterDateFrom() ? this.toIsoDate(this.filterDateFrom()!) : undefined;
    const dateTo = this.filterDateTo() ? this.toIsoDate(this.filterDateTo()!) : undefined;

    this.attendanceService.getMyAttendanceRecords(this.filterSubjectId() ?? undefined, dateFrom, dateTo).subscribe({
      next: (data) => {
        this.records.set(data);
        this.recordsLoading.set(false);
      },
      error: () => {
        this.recordsError.set('Could not load the attendance log right now.');
        this.recordsLoading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filterSubjectId.set(null);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    this.loadRecords();
  }

  // NOTE: was previously `d.toISOString().slice(0, 10)`, which converts to
  // UTC first — for any timezone ahead of UTC (e.g. Pakistan, UTC+5) a date
  // picked at local midnight rolls back to the previous day (picking 9 Aug
  // sent "2026-08-08" to the backend). Build the ISO string from the local
  // Y/M/D parts instead so the date sent matches the date picked.
  private toIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  severityFor(percentage: number): 'success' | 'warn' | 'danger' {
    if (percentage >= 85) return 'success';
    if (percentage >= 75) return 'warn';
    return 'danger';
  }

  ringColor(percentage: number): string {
    if (percentage >= 85) return '#2f9e44';
    if (percentage >= 75) return '#f5a524';
    return '#e5484d';
  }

  statusSeverity(status: string): 'success' | 'danger' | 'warn' | 'info' {
    switch (status) {
      case 'present':
        return 'success';
      case 'absent':
        return 'danger';
      case 'late':
        return 'warn';
      default:
        return 'info';
    }
  }
}
