import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { TeacherService } from '../../../core/services/teacher.service';
import { TeacherWorkloadSummary } from '../../../core/models/teacher.model';
import { BOARD_OPTIONS } from '../../../shared/utils/board-options.util';
import { TeacherWorkloadDialogComponent } from './teacher-workload-dialog.component';

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
 * Clicking a row opens the Teacher Workload drawer
 * (TeacherWorkloadDialogComponent) with that teacher's assigned boards
 * and the exact batches/subjects they're currently teaching. Unlike the
 * Batch Summary drawer, no second request is made on click — the
 * workload-summary response already carries everything the drawer needs.
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
    TagModule, ProgressSpinnerModule, MessageModule, TeacherWorkloadDialogComponent,
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

  // --- Teacher Workload drawer (clickable row) ---
  detailOpen = signal(false);
  selectedTeacher = signal<TeacherWorkloadSummary | null>(null);

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

  /** Row click handler — opens the Teacher Workload drawer for this
   *  teacher, using the row's own already-loaded data. */
  openTeacherWorkload(teacher: TeacherWorkloadSummary): void {
    this.selectedTeacher.set(teacher);
    this.detailOpen.set(true);
  }

  closeTeacherWorkload(): void {
    this.detailOpen.set(false);
    this.selectedTeacher.set(null);
  }
}
