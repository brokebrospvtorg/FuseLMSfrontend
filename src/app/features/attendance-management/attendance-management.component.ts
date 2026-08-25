import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';

import { CoordinatorStudentAttendanceComponent } from '../coordinator/student-attendance/coordinator-student-attendance.component';
import { CoordinatorTeacherAttendanceComponent } from '../coordinator/teacher-attendance/coordinator-teacher-attendance.component';
import { AdminTeacherAttendanceComponent } from '../admin/teacher-attendance/admin-teacher-attendance.component';

/**
 * Unified Attendance management screen — "Student Attendance" and
 * "Teacher Attendance" as toggle tabs in one place, routed from BOTH
 * the Admin portal (/admin/attendance) and the Coordinator portal
 * (/coordinator/attendance). Same "one shared screen, two routes"
 * convention AcademicsManagementComponent already uses for Batches +
 * Subject Catalog — see features/academic/academics-management.
 *
 * Student Attendance is already the exact same screen/endpoints for
 * both roles (CoordinatorStudentAttendanceComponent is what
 * /admin/student-attendance and /coordinator/student-attendance both
 * routed to before this merge), so it's reused here unconditionally,
 * unchanged.
 *
 * Teacher Attendance is deliberately NOT collapsed into one
 * implementation — Admin and Coordinator genuinely have different
 * capabilities here today, and merging them would silently change
 * behavior:
 *  - Coordinator -> CoordinatorTeacherAttendanceComponent: a simple
 *    per-day bulk log (set present/absent/leave for everyone, save
 *    once).
 *  - Admin -> AdminTeacherAttendanceComponent: the richer per-period
 *    view (cascading Batch -> Board -> Level -> Subject) with
 *    mandatory Audit/Reason Logging when overriding an
 *    already-recorded status.
 * `role` picks which one renders in the Teacher Attendance tab. It's
 * bound automatically from each route's `data.role` via the app's
 * `withComponentInputBinding()` router config (see app.config.ts) —
 * no resolver or manual wiring needed.
 */
@Component({
  selector: 'app-attendance-management',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TabViewModule,
    CoordinatorStudentAttendanceComponent,
    CoordinatorTeacherAttendanceComponent,
    AdminTeacherAttendanceComponent,
  ],
  templateUrl: './attendance-management.component.html',
  styleUrl: './attendance-management.component.scss',
})
export class AttendanceManagementComponent {
  /** Set via route `data: { role: 'admin' | 'coordinator' }`. */
  @Input() role: 'admin' | 'coordinator' = 'coordinator';
}
