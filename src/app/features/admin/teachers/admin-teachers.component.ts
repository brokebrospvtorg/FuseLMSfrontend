import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { TeacherService } from '../../../core/services/teacher.service';
import { TeacherWorkloadSummary } from '../../../core/models/teacher.model';
import { BOARD_OPTIONS } from '../../../shared/utils/board-options.util';
import { TeacherWorkloadDialogComponent } from './teacher-workload-dialog.component';
import { ManageTeacherDialogComponent } from './manage-teacher-dialog.component';

/**
 * Admin/Coordinator: Teachers.
 *
 * Sidebar page for the Teachers section — one row per active teacher
 * (GET /api/teachers/workload-summary), showing name, code, and boards
 * at a glance. Mounted at both /admin/teachers and /coordinator/teachers
 * (see app.routes.ts), same reuse pattern already used for
 * Batches/Timetable/Student Attendance across the two portals — the
 * backend endpoint itself is Admin/Coordinator only (require_roles).
 *
 * Clicking a row opens the read-only Teacher Workload drawer
 * (TeacherWorkloadDialogComponent) with that teacher's assigned boards
 * and the exact batches/subjects they're currently teaching. The
 * "Manage" action in the Actions column instead opens
 * ManageTeacherDialogComponent — a read/write view that can add or
 * remove batch/subject assignments — stopPropagation'd so it doesn't
 * also trigger the row's own click-to-view handler.
 *
 * Note: the API response (TeacherWorkloadSummary) still carries a
 * `levels` field — the backend continues to compute and return it — this
 * screen simply doesn't render it. See TeacherWorkloadSummary in
 * core/models/teacher.model.ts if a future screen needs it back.
 */
@Component({
  selector: 'app-admin-teachers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, InputTextModule,
    TagModule, ButtonModule, ProgressSpinnerModule, MessageModule,
    TeacherWorkloadDialogComponent, ManageTeacherDialogComponent,
  ],
  templateUrl: './admin-teachers.component.html',
  styleUrl: './admin-teachers.component.scss',
})
export class AdminTeachersComponent implements OnInit {
  teachers = signal<TeacherWorkloadSummary[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  searchTerm = signal('');

  boardOptions = BOARD_OPTIONS;

  /** Client-side filter over the already-loaded list — matches on name,
   *  email, or teacher code, same "search by name or email" convention as
   *  admin-registry.component.ts's user directory. */
  filteredTeachers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.teachers();
    return this.teachers().filter((t) =>
      t.full_name.toLowerCase().includes(term) ||
      t.email.toLowerCase().includes(term) ||
      (t.teacher_code ?? '').toLowerCase().includes(term),
    );
  });

  // --- Teacher Workload drawer (read-only, clickable row) ---
  detailOpen = signal(false);
  selectedTeacher = signal<TeacherWorkloadSummary | null>(null);

  // --- Manage Teacher dialog (read/write, "Manage" action) ---
  manageOpen = signal(false);
  managingTeacher = signal<TeacherWorkloadSummary | null>(null);

  constructor(private teacherService: TeacherService) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.teacherService.getWorkloadSummary().subscribe({
      next: (teachers) => {
        this.teachers.set(teachers);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Could not load teachers. Please try again.');
      },
    });
  }

  boardLabel(board: string): string {
    const boardLower = board?.toLowerCase();
    return this.boardOptions.find((o) => o.value.toLowerCase() === boardLower)?.label ?? board;
  }

  /** Row click handler — opens the read-only Teacher Workload drawer for
   *  this teacher, using the row's own already-loaded data. */
  openTeacherWorkload(teacher: TeacherWorkloadSummary): void {
    this.selectedTeacher.set(teacher);
    this.detailOpen.set(true);
  }

  closeTeacherWorkload(): void {
    this.detailOpen.set(false);
    this.selectedTeacher.set(null);
  }

  /** "Manage" button handler — stops propagation so it doesn't also fire
   *  the row's openTeacherWorkload click handler. */
  openManageTeacher(teacher: TeacherWorkloadSummary, event: Event): void {
    event.stopPropagation();
    this.managingTeacher.set(teacher);
    this.manageOpen.set(true);
  }

  closeManageTeacher(): void {
    this.manageOpen.set(false);
    this.managingTeacher.set(null);
  }

  /** ManageTeacherDialogComponent's `saved` output — an assignment was
   *  added or removed, so boards/workload counts on the list may now be
   *  stale. Reload rather than patch client-side. */
  onTeacherWorkloadSaved(): void {
    this.loadTeachers();
  }
}
