
import { Component, OnInit, ViewChild, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DatePickerModule } from 'primeng/datepicker';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { TimetableService } from '../../../core/services/timetable.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { RegistryService } from '../../../core/services/registry.service';
import { TimetableSlotDetail } from '../../../core/models/attendance.model';
import { Batch, Level, Subject } from '../../../core/models/academic.model';
import { RegistryUser } from '../../../core/models/registry.model';
import { loadOfferedPairs } from '../../../shared/utils/offered-pairs.util';
import {
  TeacherCascadingFilterComponent, TeacherFilterPair, TeacherFilterOption,
  TeacherFilterSelection, TeacherFilterSubjectContext,
} from '../../../shared/ui/teacher-cascading-filter/teacher-cascading-filter.component';

const DAY_OPTIONS = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
];

// The cascade's final stage doubles as "Teacher Assignee" here — its
// option `value`/`data` is just the teacher's user id, resolved against
// the Registry's teacher list (TeacherSubjectAssignmentOut carries no
// name of its own).
type TeacherAssigneeOption = TeacherFilterOption<string>;

/**
 * Interactive Timetable Builder (Coordinator Portal Sub-Sprint 3).
 *
 * Time Sorting: period_number is gone everywhere in this app —
 * `filteredSlots` below sorts strictly by `start_time`, the only ordering
 * a slot has (see TimetableSlot's own note in the backend router).
 *
 * Cascading Dropdowns: both the search filter panel and the Add/Edit Slot
 * dialog now enforce the same strict chain — [Batch] -> [Board] ->
 * [Level/Class] -> [Subject] -> [Teacher Assignee] — via two independent
 * instances of the shared `<app-teacher-cascading-filter>` widget (one
 * per #searchCascade / #formCascade template ref, since @ViewChild only
 * resolves the first match by type). The widget's "Period" stage is
 * reused here as the Teacher Assignee stage: `loadTeacherAssigneesFor`
 * supplies teachers actually assigned to the selected Subject+Batch
 * (GET /academic/teacher-assignments?subject_id=&batch_id=), same
 * authorization philosophy as everywhere else — never widen past an
 * actual active assignment/offering.
 *
 * Create, edit-in-place, and delete slots. Every student/parent/teacher
 * view is a derived read of the same timetable_slots rows (my-timetable,
 * my-teaching-schedule) — there's no separate "publish" step or flag to
 * flip; a slot is live the moment it's saved here.
 */
@Component({
  selector: 'app-coordinator-timetable',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, DatePickerModule, ProgressSpinnerModule, TeacherCascadingFilterComponent,
  ],
  templateUrl: './coordinator-timetable.component.html',
  styleUrl: './coordinator-timetable.component.scss',
})
export class CoordinatorTimetableComponent implements OnInit {
  @ViewChild('searchCascade') searchCascade?: TeacherCascadingFilterComponent<string>;
  @ViewChild('formCascade') formCascade?: TeacherCascadingFilterComponent<string>;

  dayOptions = DAY_OPTIONS;

  slots = signal<TimetableSlotDetail[]>([]);
  loading = signal(true);

  levels = signal<Level[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  teachers = signal<RegistryUser[]>([]);

  // Every batch+subject combination with an active offering, across every
  // batch — the authorization guard for both cascade instances below (see
  // shared/utils/offered-pairs.util.ts).
  allowedPairs = signal<TeacherFilterPair[]>([]);
  pickerLoading = signal(true);
  pickerError = signal<string | null>(null);

  // --- Search filter panel: Batch -> Board -> Level -> Subject -> Teacher
  // Assignee. Each stage narrows `filteredSlots` progressively; the chain
  // resets to "show everything" the moment an earlier stage is cleared. ---
  searchSubjectCtx = signal<TeacherFilterSubjectContext | null>(null);
  searchTeacherId = signal<string | null>(null);

  filteredSlots = computed(() => {
    let list = this.slots();
    const ctx = this.searchSubjectCtx();
    if (ctx) {
      list = list.filter((s) => s.batch_id === ctx.batch.id && s.subject_id === ctx.subject.id);
    }
    const teacherId = this.searchTeacherId();
    if (teacherId) {
      list = list.filter((s) => s.teacher_id === teacherId);
    }
    // Chronological by clock time — the only ordering a slot has now that
    // period_number is gone.
    return [...list].sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  onSearchSubjectChange(ctx: TeacherFilterSubjectContext | null): void {
    this.searchSubjectCtx.set(ctx);
    this.searchTeacherId.set(null);
  }

  onSearchSelectionChange(selection: TeacherFilterSelection<string> | null): void {
    this.searchTeacherId.set(selection?.period?.value ?? null);
  }

  clearSearchFilters(): void {
    this.searchCascade?.reset();
  }

  // --- Add/Edit dialog (shared) ---
  dialogOpen = signal(false);
  dialogMode = signal<'create' | 'edit'>('create');
  editingSlotId = signal<string | null>(null);
  submitting = signal(false);
  formNote = signal<string | null>(null);

  // Full Batch -> Board -> Level -> Subject -> Teacher Assignee selection
  // for the dialog; null until every stage resolves. day/start/end aren't
  // part of the cascade — they're plain fields alongside it.
  formSelection = signal<TeacherFilterSelection<string> | null>(null);
  formDay = signal<string | null>(null);
  formStartTime = signal<Date | null>(null);
  formEndTime = signal<Date | null>(null);

  constructor(
    private timetableService: TimetableService,
    private academicsStaffService: AcademicsStaffService,
    private registryService: RegistryService,
  ) {}

  ngOnInit(): void {
    this.loadSlots();
    this.academicsStaffService.getLevels().subscribe({ next: (l) => this.levels.set(l) });
    this.academicsStaffService.getSubjects().subscribe({ next: (s) => this.subjects.set(s) });
    this.registryService.getUsers('teacher').subscribe({ next: (t) => this.teachers.set(t) });

    this.pickerLoading.set(true);
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

  private loadSlots(): void {
    this.loading.set(true);
    this.timetableService.getSlots().subscribe({
      next: (data) => {
        this.slots.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Teacher Assignee stage: teachers actually assigned to teach the
   *  cascade's resolved Subject within its resolved Batch. Fanned out per
   *  active board server-side (same as every other offering-backed list),
   *  so this dedupes by teacher id — a teacher assigned once shouldn't
   *  appear twice just because the subject's offering spans 2+ boards. */
  loadTeacherAssigneesFor = (
    ctx: TeacherFilterSubjectContext,
  ): Observable<TeacherAssigneeOption[]> => {
    return this.academicsStaffService.getTeacherAssignments(ctx.subject.id, ctx.batch.id).pipe(
      map((assignments) => {
        const teachersById = new Map(this.teachers().map((t) => [t.id, t]));
        const seen = new Set<string>();
        const options: TeacherAssigneeOption[] = [];
        for (const a of assignments) {
          if (seen.has(a.teacher_id)) continue;
          const teacher = teachersById.get(a.teacher_id);
          if (!teacher) continue;
          seen.add(a.teacher_id);
          options.push({ label: teacher.full_name, value: teacher.id, data: teacher.id });
        }
        return options.sort((a, b) => a.label.localeCompare(b.label));
      }),
    );
  };

  openCreateDialog(): void {
    this.dialogMode.set('create');
    this.editingSlotId.set(null);
    this.formNote.set(null);
    this.formSelection.set(null);
    this.formDay.set(null);
    this.formStartTime.set(null);
    this.formEndTime.set(null);
    this.dialogOpen.set(true);
    // The cascade lives inside the dialog's template; its ViewChild isn't
    // populated until Angular checks that view on the next tick.
    queueMicrotask(() => this.formCascade?.reset());
  }

  openEditDialog(slot: TimetableSlotDetail): void {
    this.dialogMode.set('edit');
    this.editingSlotId.set(slot.id);
    this.formNote.set(null);
    this.formSelection.set(null);
    this.formDay.set(slot.day_of_week);
    this.formStartTime.set(this.timeStringToDate(slot.start_time));
    this.formEndTime.set(this.timeStringToDate(slot.end_time));
    this.dialogOpen.set(true);

    // A raw TimetableSlot doesn't store which board its offering was
    // under (that's resolved server-side, per-request, from the active
    // batch_subjects rows) — pick whichever active board this slot's
    // batch+subject pair currently has, sorted first, same fallback
    // convention the backend itself uses when board is otherwise
    // ambiguous. If the offering's since been withdrawn entirely (no
    // board left), leave the cascade blank rather than guessing — the
    // Coordinator re-picks Batch/Board/Level/Subject/Teacher from scratch.
    const boards = this.allowedPairs()
      .filter((p) => p.batchId === slot.batch_id && p.subjectId === slot.subject_id)
      .map((p) => p.board)
      .sort();
    const board = boards[0];

    queueMicrotask(() => {
      if (!board) {
        this.formNote.set(
          "This subject's offering for this batch has changed — please re-select Batch, Board, Level, Subject, and Teacher.",
        );
        return;
      }
      this.formCascade?.applyDeepLink({
        batchId: slot.batch_id,
        subjectId: slot.subject_id,
        board,
        periodValue: slot.teacher_id,
      });
    });
  }

  onFormSelectionChange(selection: TeacherFilterSelection<string> | null): void {
    this.formSelection.set(selection);
  }

  submit(): void {
    const selection = this.formSelection();
    const day = this.formDay();
    const start = this.formStartTime();
    const end = this.formEndTime();

    if (!selection || !selection.period || !day || !start || !end) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing info',
        text: 'Complete Batch, Board, Level, Subject, Teacher Assignee, Day, and both times before saving.',
      });
      return;
    }

    const payload = {
      level_id: selection.levelId,
      subject_id: selection.subject.id,
      teacher_id: selection.period.value,
      batch_id: selection.batch.id,
      day_of_week: day,
      start_time: this.dateToTimeString(start),
      end_time: this.dateToTimeString(end),
    };

    this.submitting.set(true);

    if (this.dialogMode() === 'create') {
      this.timetableService.createSlot(payload).subscribe({
        next: () => this.onSaved(),
        error: (err) => this.onSaveError(err),
      });
    } else {
      const slotId = this.editingSlotId();
      if (!slotId) return;
      this.timetableService.updateSlot(slotId, payload).subscribe({
        next: () => this.onSaved(),
        error: (err) => this.onSaveError(err),
      });
    }
  }

  private onSaved(): void {
    this.submitting.set(false);
    this.dialogOpen.set(false);
    Swal.fire({ icon: 'success', title: 'Saved', confirmButtonColor: '#101d3c' });
    this.loadSlots();
  }

  private onSaveError(err: any): void {
    this.submitting.set(false);
    Swal.fire({ icon: 'error', title: 'Could not save', text: err?.error?.detail ?? 'Please try again.' });
  }

  deleteSlot(slot: TimetableSlotDetail): void {
    Swal.fire({
      icon: 'warning',
      title: `Delete this slot?`,
      text: `${slot.subject_name} — ${slot.day_of_week} ${slot.start_time}–${slot.end_time}`,
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.timetableService.deleteSlot(slot.id).subscribe({
        next: () => this.loadSlots(),
        error: (err) => Swal.fire({ icon: 'error', title: 'Could not delete', text: err?.error?.detail ?? 'Please try again.' }),
      });
    });
  }

  private timeStringToDate(t: string): Date {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  private dateToTimeString(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}:00`;
  }
}