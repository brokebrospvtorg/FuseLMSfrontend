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
import { Batch, Level, Subject } from '../../../core/models/academic.model';
import { AttendanceStatus } from '../../../core/models/enums';
import { loadOfferedPairs } from '../../../shared/utils/offered-pairs.util';
import {
  TeacherCascadingFilterComponent, TeacherFilterPair, TeacherFilterSubjectContext,
} from '../../../shared/ui/teacher-cascading-filter/teacher-cascading-filter.component';

interface EditableRow {
  student_user_id: string;
  full_name: string;
  status: AttendanceStatus | 'unset';
}

interface PeriodOption {
  label: string;
  value: string;
  data: TimetableSlotDetail;
}

/**
 * Coordinator Portal — Day-Wise Attendance (No Calendar).
 * Sub-Sprint 3: "Edit capability for previous dates' student attendance
 * records (bypassing the teacher lock)." The Teacher's own Mark Attendance
 * screen locks a period read-only the moment it's submitted (no lock flag
 * in the DB — the lock is just "only the Teacher endpoint can write, and
 * the Teacher UI treats a fetched record as done"). This screen
 * deliberately writes through the separate Coordinator-only endpoints in
 * attendance.py instead of ever touching the Teacher's own /mark-students
 * path.
 *
 * Cascading Dropdowns rewrite: the old "pick a batch, then pick from one
 * long flat dropdown of every class/period" picker is gone. Selection is
 * now the same enforced chain used everywhere else in the app —
 * [Batch] -> [Board] -> [Level/Class] -> [Subject] -> [Period/Date] — via
 * the shared `<app-teacher-cascading-filter>` widget (Batch/Board/Level/
 * Subject stages) plus a Date field and a Period dropdown scoped to that
 * date's weekday (the widget's own Period stage is Teacher-scoped and
 * "today only", so the Coordinator's Date+Period pair is driven locally
 * instead — see onSubjectContextChange/onDateChange below). There never
 * was a full calendar component here to begin with (just a single-date
 * p-datepicker); it stays a single date field, capped at today since
 * attendance can't exist for a future date.
 */
@Component({
  selector: 'app-coordinator-student-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, DatePickerModule,
    SelectButtonModule, ButtonModule, ProgressSpinnerModule, MessageModule,
    TeacherCascadingFilterComponent,
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

  readonly today = new Date();

  // --- Cascade catalog data + authorization guard ---
  batches = signal<Batch[]>([]);
  subjects = signal<Subject[]>([]);
  levels = signal<Level[]>([]);
  slots = signal<TimetableSlotDetail[]>([]);
  allowedPairs = signal<TeacherFilterPair[]>([]);
  pickerLoading = signal(true);
  pickerError = signal<string | null>(null);

  // Batch -> Board -> Level -> Subject stage; the chain stops at Subject —
  // Period/Date are handled locally below, since Period here depends on a
  // Date the shared widget has no concept of.
  subjectContext = signal<TeacherFilterSubjectContext | null>(null);

  selectedDate = signal<Date>(new Date());
  selectedSlotId = signal<string | null>(null);

  // Period options: every timetable slot for the selected Subject+Batch
  // that falls on the selected Date's weekday, chronological by start
  // time — no period_number anywhere in this app any more.
  periodOptions = computed<PeriodOption[]>(() => {
    const ctx = this.subjectContext();
    if (!ctx) return [];
    const weekday = this.weekdayFor(this.selectedDate());
    return this.slots()
      .filter((s) => s.subject_id === ctx.subject.id && s.batch_id === ctx.batch.id && s.day_of_week === weekday)
      .slice()
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((slot) => ({
        label: `${slot.start_time}\u2013${slot.end_time} (${slot.teacher_name})`,
        value: slot.id,
        data: slot,
      }));
  });

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
    this.pickerLoading.set(true);
    this.timetableService.getSlots().subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.academicsStaffService.getSubjects().subscribe((s) => this.subjects.set(s));
        this.academicsStaffService.getLevels().subscribe((l) => this.levels.set(l));
        this.academicsStaffService.getBatches().subscribe({
          next: (batches) => {
            this.batches.set(batches);
            loadOfferedPairs(this.academicsStaffService, batches).subscribe({
              next: (pairs) => {
                this.allowedPairs.set(pairs);
                this.pickerLoading.set(false);
              },
              error: () => {
                this.pickerError.set('Could not load the batch/board/subject offerings right now.');
                this.pickerLoading.set(false);
              },
            });
          },
          error: () => {
            this.pickerError.set('Could not load batches right now.');
            this.pickerLoading.set(false);
          },
        });
      },
      error: () => {
        this.pickerError.set('Could not load the timetable right now.');
        this.pickerLoading.set(false);
      },
    });
  }

  /** Fires whenever the Batch -> Board -> Level -> Subject chain resolves
   *  (or stops resolving). Resets the Period/Date stage below it every
   *  time, same "auto-reset on parent change" rule the rest of the
   *  cascade already follows. */
  onSubjectContextChange(ctx: TeacherFilterSubjectContext | null): void {
    this.subjectContext.set(ctx);
    this.selectedSlotId.set(null);
    this.rows.set([]);
    this.error.set(null);
  }

  onDateChange(): void {
    this.selectedSlotId.set(null);
    this.rows.set([]);
    this.error.set(null);
  }

  onPeriodChange(slotId: string | null): void {
    this.selectedSlotId.set(slotId);
    if (!slotId) {
      this.rows.set([]);
      return;
    }
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
    const ctx = this.subjectContext();
    if (!slotId || !ctx) return;

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
        subject_id: ctx.subject.id,
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

  private weekdayFor(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  }

  private toIsoDate(d: Date): string {
    // Local calendar date, not UTC — a date-only picker converted via
    // toISOString() can roll back a day depending on timezone.
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
