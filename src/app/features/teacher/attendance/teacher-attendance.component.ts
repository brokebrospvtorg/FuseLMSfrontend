import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { Subject, Batch } from '../../../core/models/academic.model';
import { RosterEntry } from '../../../core/models/academics-staff.model';
import { TeacherTimetableSlot } from '../../../core/models/attendance.model';
import { AttendanceStatus } from '../../../core/models/enums';

interface PeriodOption {
  label: string;
  slot: TeacherTimetableSlot;
}

/** Roster entry + editable status for the marking grid. Defaults every
 *  student to Present — the common case — so the teacher only has to
 *  touch the exceptions, same "mark the exceptions" convention the
 *  Coordinator's Teacher Attendance Registry uses. */
interface AttendanceRow extends RosterEntry {
  status: AttendanceStatus;
}

/**
 * Sub-Sprint 3 — Teacher marks their own students' attendance.
 * 3.1: class/period picker + per-student Present/Absent/Late/Excused grid
 *      (built in Sub-Sprint 8.1, carried over).
 * 3.2 (this pass): once a period+date has already been submitted, the
 *      screen loads read-only instead of editable — same code path
 *      whether that's "I just submitted a minute ago" or "I'm looking
 *      at last Tuesday". Locking is driven by the backend's actual
 *      records (GET /my-period-records), not just local UI state, so a
 *      page refresh mid-session still shows the correct locked view.
 */
@Component({
  selector: 'app-teacher-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, DatePickerModule,
    SelectModule, SelectButtonModule, ButtonModule, ProgressSpinnerModule, MessageModule, TagModule,
  ],
  templateUrl: './teacher-attendance.component.html',
  styleUrl: './teacher-attendance.component.scss',
})
export class TeacherAttendanceComponent implements OnInit {
  statusOptions: { label: string; value: AttendanceStatus }[] = [
    { label: 'Present', value: AttendanceStatus.Present },
    { label: 'Absent', value: AttendanceStatus.Absent },
    { label: 'Late', value: AttendanceStatus.Late },
    { label: 'Excused', value: AttendanceStatus.Excused },
  ];

  selectedDate = signal<Date>(new Date());

  slots = signal<TeacherTimetableSlot[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  pickerLoading = signal(true);
  pickerError = signal<string | null>(null);

  selectedSlotId = signal<string | null>(null);

  // Only this teacher's periods that actually fall on the selected date's
  // weekday — a period on a different day of week can't be marked "today".
  periodOptions = computed<PeriodOption[]>(() => {
    const weekday = this.weekdayFor(this.selectedDate());
    const subjectsById = new Map(this.subjects().map((s) => [s.id, s]));
    const batchesById = new Map(this.batches().map((b) => [b.id, b]));
    return this.slots()
      .filter((s) => s.day_of_week === weekday)
      .sort((a, b) => a.period_number - b.period_number)
      .map((slot) => {
        const subjName = subjectsById.get(slot.subject_id)?.name ?? 'Unknown subject';
        const batchName = batchesById.get(slot.batch_id)?.name ?? 'Unknown batch';
        return {
          label: `Period ${slot.period_number} — ${subjName} (${batchName}) ${slot.start_time}\u2013${slot.end_time}`,
          slot,
        };
      });
  });

  selectedPeriod = computed(
    () => this.periodOptions().find((p) => p.slot.id === this.selectedSlotId()) ?? null,
  );

  roster = signal<AttendanceRow[]>([]);
  rosterLoading = signal(false);
  saving = signal(false);

  // Sub-Sprint 3.2 — true once this period+date already has records,
  // either from a prior submission or because it's a past date being
  // inspected. Drives the read-only table + hides the Submit button.
  locked = signal(false);

  constructor(
    private staffService: AcademicsStaffService,
    private attendanceService: AttendanceService,
  ) {}

  ngOnInit(): void {
    this.attendanceService.getMyTeachingSlots().subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.staffService.getSubjects().subscribe((s) => this.subjects.set(s));
        this.staffService.getBatches().subscribe((b) => {
          this.batches.set(b);
          this.pickerLoading.set(false);
        });
      },
      error: () => {
        this.pickerError.set('Could not load your teaching schedule right now.');
        this.pickerLoading.set(false);
      },
    });
  }

  private weekdayFor(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  }

  private toIsoDate(d: Date): string {
    // Local calendar date, not UTC — matches the same helper in the
    // Coordinator Teacher Attendance screen, for the same reason.
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onDateChanged(): void {
    // The previously selected period may not exist on the new date's
    // weekday — clear it rather than silently keep marking against a
    // period that isn't actually scheduled today.
    this.selectedSlotId.set(null);
    this.roster.set([]);
    this.locked.set(false);
  }

  onPeriodSelected(period: PeriodOption | null): void {
    this.selectedSlotId.set(period?.slot.id ?? null);
    this.roster.set([]);
    this.locked.set(false);
    if (!period) return;

    this.rosterLoading.set(true);
    const dateIso = this.toIsoDate(this.selectedDate());

    // Check for existing records first — if this period+date was already
    // submitted, load it read-only instead of the fresh editable grid.
    this.attendanceService.getMyPeriodRecords(period.slot.id, dateIso).subscribe({
      next: (existingRecords) => {
        this.staffService.getRoster(period.slot.subject_id, period.slot.batch_id).subscribe({
          next: (entries) => {
            if (existingRecords.length > 0) {
              const statusByStudent = new Map(existingRecords.map((r) => [r.student_user_id, r.status]));
              this.roster.set(
                entries.map((e) => ({
                  ...e,
                  status: statusByStudent.get(e.student_id) ?? AttendanceStatus.Present,
                })),
              );
              this.locked.set(true);
            } else {
              this.roster.set(entries.map((e) => ({ ...e, status: AttendanceStatus.Present })));
              this.locked.set(false);
            }
            this.rosterLoading.set(false);
          },
          error: () => {
            this.rosterLoading.set(false);
            Swal.fire({ icon: 'error', title: 'Could not load the class list', text: 'Please try again.' });
          },
        });
      },
      error: () => {
        this.rosterLoading.set(false);
        Swal.fire({ icon: 'error', title: 'Could not check attendance status', text: 'Please try again.' });
      },
    });
  }

  setStatus(row: AttendanceRow, status: AttendanceStatus): void {
    if (this.locked()) return; // read-only once submitted — belt and braces alongside the disabled control
    this.roster.update((rows) =>
      rows.map((r) => (r.student_id === row.student_id ? { ...r, status } : r)),
    );
  }

  submit(): void {
    const period = this.selectedPeriod();
    const rows = this.roster();
    if (!period || rows.length === 0 || this.locked()) return;

    this.saving.set(true);
    this.attendanceService
      .markStudentAttendance({
        timetable_slot_id: period.slot.id,
        subject_id: period.slot.subject_id,
        date: this.toIsoDate(this.selectedDate()),
        records: rows.map((r) => ({ student_user_id: r.student_id, status: r.status })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.locked.set(true); // lock immediately — don't wait for a refetch
          Swal.fire({
            icon: 'success',
            title: 'Attendance saved',
            text: `${rows.length} student(s) marked for this period. Your own attendance for this period has also been marked Present automatically.`,
            timer: 2800,
            showConfirmButton: false,
          });
        },
        error: (err) => {
          this.saving.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not save attendance',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
  }
}
