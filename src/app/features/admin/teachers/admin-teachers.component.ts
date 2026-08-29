import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { TeacherService } from '../../../core/services/teacher.service';
import { UserService } from '../../../core/services/user.service';
import { TeacherWorkloadSummary } from '../../../core/models/teacher.model';
import { UserRole } from '../../../core/models/enums';
import { TeacherWorkloadDialogComponent } from './teacher-workload-dialog.component';
import { ManageTeacherDialogComponent } from './manage-teacher-dialog.component';

/**
 * Admin/Coordinator: Teachers.
 *
 * Sidebar page for the Teachers section — one row per active teacher
 * (GET /api/teachers/workload-summary), showing name, code, and current
 * workload at a glance. Mounted at both /admin/teachers and /coordinator/teachers
 * (see app.routes.ts), same reuse pattern already used for
 * Batches/Timetable/Student Attendance across the two portals — the
 * backend endpoint itself is Admin/Coordinator only (require_roles).
 *
 * Strictly-Teacher filtering (frontend-only):
 * GET /api/teachers/workload-summary is deliberately dual-role-inclusive
 * server-side — a Coordinator who still holds a teacher_profiles row is
 * included on purpose (see get_teacher_workload_summary's own docstring
 * in app/routers/teachers.py), because other screens (the Coordinator
 * Timetable Builder's Teacher Assignee dropdown, the Dual-Role Switcher)
 * need that. This screen wants the opposite: ONLY users whose current
 * role is literally 'teacher', Coordinators excluded outright.
 *
 * TeacherWorkloadSummaryOut doesn't carry a `role` field at all — it was
 * never part of that response shape — so a plain `row.role === 'coordinator'`
 * filter on the workload-summary array is a silent no-op (row.role is
 * always undefined). Since the backend contract isn't changing, this
 * cross-references a second, already-existing call — GET
 * /api/users?role=teacher (UserService.getUsersByRole, used the same way
 * by manage-batch-dialog.component.ts) — whose UserOut rows DO carry a
 * real `role` column value (that endpoint is also dual-role-inclusive by
 * design, but each row's own `role` still tells the truth about who's
 * currently a Coordinator). loadTeachers() below builds the set of ids
 * whose role is strictly 'teacher' from that call, and filters the
 * workload-summary rows down to just those ids before they ever reach
 * `teachers()` — so search, the drawer, and Manage all only ever see
 * strictly-Teacher rows, with no change to either backend endpoint.
 *
 * Clicking a row opens the read-only Teacher Workload drawer
 * (TeacherWorkloadDialogComponent) with the exact batches/subjects
 * they're currently teaching. The "Manage" action in the Actions
 * column instead opens
 * ManageTeacherDialogComponent — a read/write view that can add or
 * remove batch/subject assignments — stopPropagation'd so it doesn't
 * also trigger the row's own click-to-view handler.
 *
 * Note: the API response (TeacherWorkloadSummary) still carries a
 * `levels` field — the backend continues to compute and return it —
 * this screen simply doesn't render it. See TeacherWorkloadSummary in
 * core/models/teacher.model.ts if a future screen needs it.
 */
@Component({
  selector: 'app-admin-teachers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, InputTextModule,
    ButtonModule, ProgressSpinnerModule, MessageModule,
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

  /** Client-side filter over the already-loaded (and already
   *  strictly-Teacher-filtered) list — matches on name, email, or
   *  teacher code, same "search by name or email" convention as
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

  constructor(
    private teacherService: TeacherService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadTeachers(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      workload: this.teacherService.getWorkloadSummary(),
      users: this.userService.getUsersByRole(UserRole.Teacher),
    }).subscribe({
      next: ({ workload, users }) => {
        // See this component's own docstring above for why this
        // cross-reference is needed: workload-summary carries no `role`
        // field, and GET /api/users?role=teacher is itself dual-role-
        // inclusive — so only the rows from `users` whose OWN role is
        // strictly 'teacher' count here, everything else (a Coordinator
        // who still has a teacher_profiles row) is dropped.
        const strictTeacherIds = new Set(
          users.filter((u) => u.role === UserRole.Teacher).map((u) => u.id),
        );
        this.teachers.set(workload.filter((t) => strictTeacherIds.has(t.id)));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Could not load teachers. Please try again.');
      },
    });
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
   *  added or removed, so workload counts on the list may now be
   *  stale. Reload rather than patch client-side. */
  onTeacherWorkloadSaved(): void {
    this.loadTeachers();
  }
}
