import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { TimetableService } from '../../../core/services/timetable.service';
import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { RegistryService } from '../../../core/services/registry.service';
import { TimetableSlotDetail } from '../../../core/models/attendance.model';
import { Batch, Level, Subject } from '../../../core/models/academic.model';
import { RegistryUser } from '../../../core/models/registry.model';

const DAY_OPTIONS = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
];

/**
 * Interactive Timetable Builder (Coordinator Portal Sub-Sprint 3). Create,
 * edit-in-place (see the PATCH added to timetable.py — previously only
 * create+delete existed), and delete slots. Every student/parent/teacher
 * view is a derived read of the same timetable_slots rows (my-timetable,
 * my-teaching-schedule) — there's no separate "publish" step or flag to
 * flip; a slot is live the moment it's saved here.
 */
@Component({
  selector: 'app-coordinator-timetable',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputNumberModule, DatePickerModule, ProgressSpinnerModule,
  ],
  templateUrl: './coordinator-timetable.component.html',
  styleUrl: './coordinator-timetable.component.scss',
})
export class CoordinatorTimetableComponent implements OnInit {
  dayOptions = DAY_OPTIONS;

  slots = signal<TimetableSlotDetail[]>([]);
  loading = signal(true);

  levels = signal<Level[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  teachers = signal<RegistryUser[]>([]);

  batchOptions = computed(() => [
    { label: 'All batches', value: null },
    ...this.batches().map((b) => ({ label: b.name, value: b.id })),
  ]);

  batchFilter = signal<string | null>(null);
  filteredSlots = computed(() => {
    const b = this.batchFilter();
    return b ? this.slots().filter((s) => s.batch_id === b) : this.slots();
  });

  // --- Add/Edit dialog (shared) ---
  dialogOpen = signal(false);
  dialogMode = signal<'create' | 'edit'>('create');
  editingSlotId = signal<string | null>(null);
  submitting = signal(false);

  formLevelId = signal<string | null>(null);
  formSubjectId = signal<string | null>(null);
  formTeacherId = signal<string | null>(null);
  formBatchId = signal<string | null>(null);
  formDay = signal<string | null>(null);
  formPeriod = signal<number | null>(null);
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
    this.academicsStaffService.getBatches().subscribe({ next: (b) => this.batches.set(b) });
    this.registryService.getUsers('teacher').subscribe({ next: (t) => this.teachers.set(t) });
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

  openCreateDialog(): void {
    this.dialogMode.set('create');
    this.editingSlotId.set(null);
    this.formLevelId.set(null);
    this.formSubjectId.set(null);
    this.formTeacherId.set(null);
    this.formBatchId.set(this.batchFilter());
    this.formDay.set(null);
    this.formPeriod.set(null);
    this.formStartTime.set(null);
    this.formEndTime.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(slot: TimetableSlotDetail): void {
    this.dialogMode.set('edit');
    this.editingSlotId.set(slot.id);
    this.formSubjectId.set(slot.subject_id);
    this.formTeacherId.set(slot.teacher_id);
    this.formBatchId.set(slot.batch_id);
    this.formDay.set(slot.day_of_week);
    this.formPeriod.set(slot.period_number);
    this.formStartTime.set(this.timeStringToDate(slot.start_time));
    this.formEndTime.set(this.timeStringToDate(slot.end_time));
    // level_id isn't in the detail response — subject implies a level, but
    // we don't force the picker to a value; PATCH omits level_id entirely
    // when editing unless the coordinator explicitly changes the subject.
    this.formLevelId.set(null);
    this.dialogOpen.set(true);
  }

  submit(): void {
    const subjectId = this.formSubjectId();
    const teacherId = this.formTeacherId();
    const batchId = this.formBatchId();
    const day = this.formDay();
    const period = this.formPeriod();
    const start = this.formStartTime();
    const end = this.formEndTime();

    if (!subjectId || !teacherId || !batchId || !day || !period || !start || !end) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Fill in every field before saving.' });
      return;
    }

    this.submitting.set(true);

    if (this.dialogMode() === 'create') {
      const levelId = this.formLevelId();
      if (!levelId) {
        this.submitting.set(false);
        Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Level is required for a new slot.' });
        return;
      }
      this.timetableService
        .createSlot({
          level_id: levelId, subject_id: subjectId, teacher_id: teacherId, batch_id: batchId,
          day_of_week: day, period_number: period,
          start_time: this.dateToTimeString(start), end_time: this.dateToTimeString(end),
        })
        .subscribe({
          next: () => this.onSaved(),
          error: (err) => this.onSaveError(err),
        });
    } else {
      const slotId = this.editingSlotId();
      if (!slotId) return;
      this.timetableService
        .updateSlot(slotId, {
          subject_id: subjectId, teacher_id: teacherId, batch_id: batchId,
          day_of_week: day, period_number: period,
          start_time: this.dateToTimeString(start), end_time: this.dateToTimeString(end),
        })
        .subscribe({
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
      text: `${slot.subject_name} — ${slot.day_of_week} period ${slot.period_number}`,
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