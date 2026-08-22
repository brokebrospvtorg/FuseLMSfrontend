import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AttendanceService } from '../../../core/services/attendance.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { AdminTeacherAttendanceEntry } from '../../../core/models/attendance.model';
import { Batch, Level, Subject } from '../../../core/models/academic.model';
import { AttendanceStatus } from '../../../core/models/enums';
import { loadOfferedPairs } from '../../../shared/utils/offered-pairs.util';
import {
  TeacherCascadingFilterComponent, TeacherFilterPair, TeacherFilterSubjectContext,
} from '../../../shared/ui/teacher-cascading-filter/teacher-cascading-filter.component';

/** Local editable row — `draftStatus` is what the SelectButton is bound
 *  to; `status`/`attendance_record_id` stay untouched until a save
 *  actually succeeds (then the row is re-fetched from the server, same
 *  "never trust the optimistic local edit" rule the rest of the app's
 *  override screens follow — see coordinator-grades.component.ts). */
interface AdminAttendanceRow {
  timetable_slot_id: string;
  start_time: string;
  end_time: string;
  teacher_id: string;
  teacher_name: string;
  attendance_record_id: string | null;
  status: AttendanceStatus | null;
  draftStatus: AttendanceStatus | 'unset';
}

/**
 * Admin Portal — Teacher Attendance (View & Edit, full Coordinator
 * parity). Backend: app/routers/attendance.py —
 * GET/POST /api/attendance/admin/teacher-attendance.
 *
 * Cascading Selection: the enforced Batch -> Board -> Level -> Subject
 * chain (shared <app-teacher-cascading-filter> widget, same as the
 * Coordinator's Student Attendance and Mark Override screens) scopes
 * which periods show up at all; a Date field alongside it (capped at
 * today, same "no future dates" rule used everywhere attendance is
 * edited) determines which day's periods are fetched. Every period on
 * that day for the selected Batch/Board/Level/Subject renders as one
 * row, each with its OWN assigned teacher and that teacher's own
 * attendance status for that period+date — this is genuinely a Teacher
 * Attendance screen, not a student roster.
 *
 * Mark & Edit: an unmarked row (status === null) can be marked directly,
 * no reason required — there is nothing being corrected yet. A row that
 * already has a recorded status requires a reason to change (Audit/
 * Reason Logging) — entering one and confirming logs the change to the
 * server's audit trail (GET /api/audit-logs?entity_type=attendance_records)
 * and notifies the teacher, exactly like the Coordinator Mark Override
 * screen's override_reason flow.
 */
@Component({
  selector: 'app-admin-teacher-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, DatePickerModule, SelectButtonModule,
    ButtonModule, DialogModule, TextareaModule, TagModule, ProgressSpinnerModule, MessageModule,
    TeacherCascadingFilterComponent,
  ],
  templateUrl: './admin-teacher-attendance.component.html',
  styleUrl: './admin-teacher-attendance.component.scss',
})
export class AdminTeacherAttendanceComponent implements OnInit {
  statusOptions: { label: string; value: AttendanceStatus }[] = [
    { label: 'Present', value: AttendanceStatus.Present },
    { label: 'Absent', value: AttendanceStatus.Absent },
    { label: 'Late', value: AttendanceStatus.Late },
    { label: 'Excused', value: AttendanceStatus.Excused },
  ];

  readonly today = new Date();

  // --- Cascade catalog data (coordinator-wide — an Admin isn't scoped
  // to "my own" assignments the way a Teacher is, so this uses the same
  // offered-pairs source the Coordinator's own cascading screens do). ---
  batches = signal<Batch[]>([]);
  subjects = signal<Subject[]>([]);
  levels = signal<Level[]>([]);
  allowedPairs = signal<TeacherFilterPair[]>([]);
  pickerLoading = signal(true);
  pickerError = signal<string | null>(null);

  // Batch -> Board -> Level -> Subject stage. The chain intentionally
  // stops at Subject (periodsEnabled=false) — unlike the Teacher/
  // Coordinator single-period screens, this page shows EVERY period for
  // the selected Subject+Batch on the chosen date at once, not just one.
  subjectContext = signal<TeacherFilterSubjectContext | null>(null);
  selectedDate = signal<Date>(new Date());

  rows = signal<AdminAttendanceRow[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // --- Reason dialog (Audit/Reason Logging — required when editing an
  // already-recorded status; see saveRow()) ---
  reasonDialogOpen = signal(false);
  reasonDialogRow = signal<AdminAttendanceRow | null>(null);
  reasonText = signal('');
  savingSlotId = signal<string | null>(null);

  constructor(
    private attendanceService: AttendanceService,
    private academicsStaffService: AcademicsStaffService,
  ) {}

  ngOnInit(): void {
    this.pickerLoading.set(true);
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
  }

  /** Fires whenever the Batch -> Board -> Level -> Subject chain resolves
   *  (or stops resolving) — reloads the period rows for whatever Date is
   *  currently selected. */
  onSubjectContextChange(ctx: TeacherFilterSubjectContext | null): void {
    this.subjectContext.set(ctx);
    this.error.set(null);
    if (ctx) {
      this.loadRows(ctx);
    } else {
      this.rows.set([]);
    }
  }

  onDateChange(): void {
    const ctx = this.subjectContext();
    this.error.set(null);
    if (ctx) {
      this.loadRows(ctx);
    } else {
      this.rows.set([]);
    }
  }

  private loadRows(ctx: TeacherFilterSubjectContext): void {
    this.loading.set(true);
    this.error.set(null);
    this.attendanceService
      .getAdminTeacherAttendance(this.toIsoDate(this.selectedDate()), ctx.batch.id, ctx.board, ctx.levelId, ctx.subject.id)
      .subscribe({
        next: (entries: AdminTeacherAttendanceEntry[]) => {
          this.rows.set(
            entries.map((e) => ({
              timetable_slot_id: e.timetable_slot_id,
              start_time: e.start_time,
              end_time: e.end_time,
              teacher_id: e.teacher_id,
              teacher_name: e.teacher_name,
              attendance_record_id: e.attendance_record_id,
              status: e.status,
              draftStatus: (e.status ?? 'unset') as AttendanceStatus | 'unset',
            })),
          );
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load teacher attendance for this selection.');
          this.loading.set(false);
        },
      });
  }

  setDraftStatus(row: AdminAttendanceRow, status: AttendanceStatus): void {
    row.draftStatus = status;
    this.rows.update((rows) => [...rows]);
  }

  isDirty(row: AdminAttendanceRow): boolean {
    return row.draftStatus !== 'unset' && row.draftStatus !== (row.status ?? 'unset');
  }

  /** Marking an unmarked period (no existing record) saves straight
   *  away — nothing to correct, so no reason is required. Changing an
   *  ALREADY-recorded status opens the reason dialog first — Audit/
   *  Reason Logging is mandatory for that case, enforced again
   *  server-side regardless of what the UI does. */
  saveRow(row: AdminAttendanceRow): void {
    if (!this.isDirty(row)) return;
    if (row.attendance_record_id) {
      this.reasonDialogRow.set(row);
      this.reasonText.set('');
      this.reasonDialogOpen.set(true);
    } else {
      this.submitSave(row, undefined);
    }
  }

  confirmReasonDialog(): void {
    const row = this.reasonDialogRow();
    const reason = this.reasonText().trim();
    if (!row || !reason) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Enter a reason before confirming.' });
      return;
    }
    this.submitSave(row, reason);
  }

  cancelReasonDialog(): void {
    this.reasonDialogOpen.set(false);
    this.reasonDialogRow.set(null);
    this.reasonText.set('');
  }

  private submitSave(row: AdminAttendanceRow, reason: string | undefined): void {
    const ctx = this.subjectContext();
    if (!ctx || row.draftStatus === 'unset') return;

    this.savingSlotId.set(row.timetable_slot_id);
    this.attendanceService
      .markOrOverrideAdminTeacherAttendance({
        timetable_slot_id: row.timetable_slot_id,
        subject_id: ctx.subject.id,
        teacher_user_id: row.teacher_id,
        date: this.toIsoDate(this.selectedDate()),
        status: row.draftStatus as AttendanceStatus,
        reason,
      })
      .subscribe({
        next: () => {
          this.savingSlotId.set(null);
          this.reasonDialogOpen.set(false);
          this.reasonDialogRow.set(null);
          this.reasonText.set('');
          Swal.fire({
            icon: 'success',
            title: 'Attendance saved',
            text: reason ? 'The change was logged and the teacher was notified.' : undefined,
            timer: 2400,
            showConfirmButton: false,
          });
          this.loadRows(ctx);
        },
        error: (err) => {
          this.savingSlotId.set(null);
          Swal.fire({
            icon: 'error',
            title: 'Could not save',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
  }

  statusSeverity(status: AttendanceStatus | null): 'success' | 'danger' | 'warn' | 'info' | 'secondary' {
    switch (status) {
      case 'present':
        return 'success';
      case 'absent':
        return 'danger';
      case 'late':
        return 'warn';
      case 'excused':
        return 'info';
      default:
        return 'secondary';
    }
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
