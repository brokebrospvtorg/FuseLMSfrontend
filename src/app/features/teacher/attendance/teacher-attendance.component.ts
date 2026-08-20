import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { Subject, Batch, Level } from '../../../core/models/academic.model';
import { RosterEntry } from '../../../core/models/academics-staff.model';
import { TeacherTimetableSlot, TeacherAttendanceLogEntry } from '../../../core/models/attendance.model';
import { AttendanceStatus } from '../../../core/models/enums';
import {
  TeacherCascadingFilterComponent, TeacherFilterPair, TeacherFilterOption, TeacherFilterSelection,
  TeacherFilterSubjectContext,
} from '../../../shared/ui/teacher-cascading-filter/teacher-cascading-filter.component';

type PeriodOption = TeacherFilterOption<TeacherTimetableSlot>;

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
 * 3.2: once a period+date has already been submitted, the screen loads
 *      read-only instead of editable.
 * 3.3 (this pass) — Strict current-date Day-Wise UI: the old free-pick
 *      date field (functionally a calendar-view date navigator) is gone.
 *      This screen is now locked to `today` only — there is nothing to
 *      "browse to" on the marking grid itself. Past class history moved
 *      to a dedicated read-only "View Summary" modal backed by
 *      GET /my-history-log, matching the backend's strict enforcement
 *      that Teachers can only create/edit attendance where
 *      attendance_date == date.today().
 */
@Component({
  selector: 'app-teacher-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule,
    SelectModule, SelectButtonModule, ButtonModule, ProgressSpinnerModule, MessageModule, TagModule,
    DialogModule, TeacherCascadingFilterComponent,
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

  // Fixed to today — the marking screen is a Day-Wise, single-day view.
  // Not a signal: there is no control on this screen that can change it,
  // by design (Read-Only mode for any date != today, enforced by simply
  // never offering another date here).
  readonly today = new Date();

  slots = signal<TeacherTimetableSlot[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  levels = signal<Level[]>([]);
  pickerLoading = signal(true);
  pickerError = signal<string | null>(null);

  // Authorization guard for the Batch -> Board -> Level -> Subject -> Period
  // cascade below: only subject/batch/board combinations this teacher
  // actually has a teaching slot in are ever offered, at any stage of the
  // chain. `board` comes straight off the slot (server-resolved from the
  // batch's actual active offering — see TeacherTimetableSlot.board's
  // docstring) rather than being inferred client-side.
  allowedPairs = computed<TeacherFilterPair[]>(() => {
    const seen = new Set<string>();
    const pairs: TeacherFilterPair[] = [];
    for (const s of this.slots()) {
      const key = `${s.subject_id}::${s.batch_id}::${s.board}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ subjectId: s.subject_id, batchId: s.batch_id, board: s.board });
    }
    return pairs;
  });

  // Period stage of the cascading filter: once Subject (+ its Batch +
  // Board) is resolved, offer only this teacher's periods for that exact
  // subject/batch/board that fall on today's weekday — same day-wise
  // restriction the old single-dropdown picker enforced, now scoped one
  // level deeper. `board` is included in the match because a slot fanned
  // out across multiple active boards (see TeacherTimetableSlot.board's
  // docstring) would otherwise show the same period twice once a Subject
  // offered under 2+ boards was selected.
  loadPeriodsForToday = (ctx: TeacherFilterSubjectContext) => {
    const weekday = this.weekdayFor(this.today);
    const options: PeriodOption[] = this.slots()
      .filter(
        (s) =>
          s.subject_id === ctx.subject.id &&
          s.batch_id === ctx.batch.id &&
          s.board === ctx.board &&
          s.day_of_week === weekday,
      )
      .sort((a, b) => a.period_number - b.period_number)
      .map((slot) => ({
        label: `Period ${slot.period_number} — ${slot.start_time}\u2013${slot.end_time}`,
        value: slot.id,
        data: slot,
      }));
    return of(options);
  };

  // The cascading filter's full selection once a Period has been picked —
  // null until every stage (Batch/Board/Level/Subject/Period) resolves.
  currentSelection = signal<TeacherFilterSelection<TeacherTimetableSlot> | null>(null);
  selectedPeriod = computed<PeriodOption | null>(() => this.currentSelection()?.period ?? null);

  roster = signal<AttendanceRow[]>([]);
  rosterLoading = signal(false);
  saving = signal(false);

  // True once this period+date already has records, i.e. already
  // submitted today. Drives the read-only table + hides the Submit
  // button. Since this screen only ever operates on today, this is the
  // only reason a row would be locked here.
  locked = signal(false);

  // --- Sub-Sprint 3.3 — View Summary (read-only history modal) ---
  summaryVisible = signal(false);
  summaryLoading = signal(false);
  summaryError = signal<string | null>(null);
  summaryEntries = signal<TeacherAttendanceLogEntry[]>([]);
  summarySubjectId = signal<string | null>(null);

  constructor(
    private staffService: AcademicsStaffService,
    private attendanceService: AttendanceService,
  ) {}

  ngOnInit(): void {
    this.attendanceService.getMyTeachingSlots().subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.staffService.getSubjects().subscribe((s) => this.subjects.set(s));
        this.staffService.getLevels().subscribe((l) => this.levels.set(l));
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

  openSummary(): void {
    this.summaryVisible.set(true);
    this.summarySubjectId.set(null);
    this.loadSummary();
  }

  onSummarySubjectChanged(subjectId: string | null): void {
    this.summarySubjectId.set(subjectId);
    this.loadSummary();
  }

  private loadSummary(): void {
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.attendanceService.getMyAttendanceHistoryLog(this.summarySubjectId() ?? undefined).subscribe({
      next: (entries) => {
        this.summaryEntries.set(entries);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryError.set('Could not load your attendance history right now.');
        this.summaryLoading.set(false);
      },
    });
  }

  onSelectionChange(selection: TeacherFilterSelection<TeacherTimetableSlot> | null): void {
    this.currentSelection.set(selection);
    this.roster.set([]);
    this.locked.set(false);
    const slot = selection?.period?.data;
    if (!slot) return;

    this.rosterLoading.set(true);
    const dateIso = this.toIsoDate(this.today);

    // Check for existing records first — if this period+date was already
    // submitted, load it read-only instead of the fresh editable grid.
    this.attendanceService.getMyPeriodRecords(slot.id, dateIso).subscribe({
      next: (existingRecords) => {
        this.staffService.getRoster(slot.subject_id, slot.batch_id).subscribe({
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
    const slot = this.selectedPeriod()?.data;
    const rows = this.roster();
    if (!slot || rows.length === 0 || this.locked()) return;

    this.saving.set(true);
    this.attendanceService
      .markStudentAttendance({
        timetable_slot_id: slot.id,
        subject_id: slot.subject_id,
        date: this.toIsoDate(this.today),
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
