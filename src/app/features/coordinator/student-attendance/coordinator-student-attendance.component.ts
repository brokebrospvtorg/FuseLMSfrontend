import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AttendanceService } from '../../../core/services/attendance.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { TimetableService } from '../../../core/services/timetable.service';
import { CoordinatorRosterEntry, TimetableSlotDetail } from '../../../core/models/attendance.model';
import { Batch } from '../../../core/models/academic.model';
import { AttendanceStatus } from '../../../core/models/enums';

interface EditableRow {
  student_user_id: string;
  full_name: string;
  status: AttendanceStatus | 'unset';
}

/**
 * Coordinator Portal Sub-Sprint 3: "Edit capability for previous dates'
 * student ... attendance records (bypassing the teacher lock)." The
 * Teacher's own Mark Attendance screen locks a period read-only the moment
 * it's submitted (no lock flag in the DB — the lock is just "only the
 * Teacher endpoint can write, and the Teacher UI treats a fetched record
 * as done"). This screen deliberately writes through the separate
 * Coordinator-only endpoints in attendance.py instead of ever touching the
 * Teacher's own /mark-students path.
 */
@Component({
  selector: 'app-coordinator-student-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, DatePickerModule,
    SelectButtonModule, ButtonModule, ProgressSpinnerModule, MessageModule,
  ],
  templateUrl: './coordinator-student-attendance.component.html',
  styleUrl: './coordinator-student-attendance.component.scss',
})
export class CoordinatorStudentAttendanceComponent implements OnInit {
  statusOptions: { label: string; value: AttendanceStatus }[] = [
    { label: 'Present', value: AttendanceStatus.Present },
    { label: 'Absent', value: AttendanceStatus.Absent },
    { label: 'Late', value: AttendanceStatus.Late },
    { label: 'Excused', value: AttendanceStatus.Excused },
  ];

  batches = signal<Batch[]>([]);
  slots = signal<TimetableSlotDetail[]>([]);
  selectedBatchId = signal<string | null>(null);
  selectedSlotId = signal<string | null>(null);
  selectedDate = signal<Date>(new Date());

  batchOptions = computed(() => [
    { label: 'All batches', value: null },
    ...this.batches().map((b) => ({ label: b.name, value: b.id })),
  ]);

  slotOptions = computed(() =>
    this.slots()
      .filter((s) => !this.selectedBatchId() || s.batch_id === this.selectedBatchId())
      .map((s) => ({
        label: `${s.subject_name} — ${this.capitalize(s.day_of_week)} P${s.period_number} (${s.teacher_name})`,
        value: s.id,
      })),
  );

  rows = signal<EditableRow[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  constructor(
    private attendanceService: AttendanceService,
    private academicsStaffService: AcademicsStaffService,
    private timetableService: TimetableService,
  ) {}

  ngOnInit(): void {
    this.academicsStaffService.getBatches().subscribe({ next: (b) => this.batches.set(b) });
    this.timetableService.getSlots().subscribe({ next: (s) => this.slots.set(s) });
  }

  onSlotOrDateChange(): void {
    const slotId = this.selectedSlotId();
    if (!slotId) return;
    this.loadRoster(slotId);
  }

  private loadRoster(slotId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.attendanceService.getCoordinatorRoster(slotId, this.toIsoDate(this.selectedDate())).subscribe({
      next: (roster: CoordinatorRosterEntry[]) => {
        this.rows.set(
          roster.map((r) => ({
            student_user_id: r.student_user_id,
            full_name: r.full_name,
            status: r.status ?? 'unset',
          })),
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the roster for this class right now.');
        this.loading.set(false);
      },
    });
  }

  setStatus(row: EditableRow, status: AttendanceStatus): void {
    row.status = status;
    this.rows.update((rows) => [...rows]);
  }

  save(): void {
    const slotId = this.selectedSlotId();
    const slot = this.slots().find((s) => s.id === slotId);
    if (!slotId || !slot) return;

    const records = this.rows()
      .filter((r) => r.status !== 'unset')
      .map((r) => ({ student_user_id: r.student_user_id, status: r.status as AttendanceStatus }));

    if (records.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Nothing to save', text: 'Mark at least one student before saving.' });
      return;
    }

    this.saving.set(true);
    this.attendanceService
      .overrideStudentAttendance({
        timetable_slot_id: slotId,
        subject_id: slot.subject_id,
        date: this.toIsoDate(this.selectedDate()),
        records,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          Swal.fire({ icon: 'success', title: 'Attendance saved', confirmButtonColor: '#101d3c' });
          this.loadRoster(slotId);
        },
        error: (err) => {
          this.saving.set(false);
          Swal.fire({ icon: 'error', title: 'Could not save', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private toIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}