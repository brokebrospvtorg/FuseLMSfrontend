import { Routes } from '@angular/router';
import { PortalLayoutComponent, PortalNavItem } from './shared/layout/portal-layout/portal-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/models/enums';

const teacherNav: PortalNavItem[] = [
  { label: 'Attendance', icon: 'attendance', route: '/teacher/attendance' },
  { label: 'Marks & Assessments', icon: 'grades', route: '/teacher/marks' },
];

const coordinatorNav: PortalNavItem[] = [
  { label: 'Subject Requests', icon: 'subject-requests', route: '/coordinator/subject-requests' },
  { label: 'Teacher Attendance', icon: 'attendance', route: '/coordinator/teacher-attendance' },
  { label: 'Grade Overrides', icon: 'grades', route: '/coordinator/grades' },
  { label: 'Fee Proofs', icon: 'fees', route: '/coordinator/fees-review' },
  { label: 'Information Registry', icon: 'registry', route: '/coordinator/registry' },
];

const adminNav: PortalNavItem[] = [
  { label: 'Information Registry', icon: 'registry', route: '/admin/registry' },
];

const parentNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/parent/dashboard' },
  { label: 'Report Card', icon: 'grades', route: '/parent/report-card' },
  { label: 'Fee Ledger', icon: 'fees', route: '/parent/fees' },
  { label: 'Complaints', icon: 'complaints', route: '/parent/complaints' },
];

const studentNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/student/dashboard' },
  { label: 'Attendance Report', icon: 'attendance', route: '/student/attendance' },
  { label: 'Timetable', icon: 'timetable', route: '/student/timetable' },
  { label: 'Grades Report', icon: 'grades', route: '/student/grades' },
  { label: 'Feedback/Complaints', icon: 'complaints', route: '/student/complaints' },
  { label: 'Fee System', icon: 'fees', route: '/student/fees' },
  { label: 'Lecture Materials', icon: 'materials', route: '/student/materials' },
  { label: 'Lectures', icon: 'lectures', route: '/student/lectures' },
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'student',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Student Portal', navItems: studentNav },
    canActivate: [authGuard, roleGuard([UserRole.Student])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/student/dashboard/student-dashboard.component').then(
            (m) => m.StudentDashboardComponent,
          ),
      },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent),
      },
      {
        path: 'timetable',
        loadComponent: () =>
          import('./features/academic/academic.component').then((m) => m.AcademicComponent),
      },
      {
        path: 'subject-requests',
        loadComponent: () =>
          import('./features/academic/academic.component').then((m) => m.AcademicComponent),
      },
      {
        path: 'grades',
        loadComponent: () => import('./features/marks/marks.component').then((m) => m.MarksComponent),
      },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./features/communication/communication.component').then(
            (m) => m.CommunicationComponent,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/communication/communication.component').then(
            (m) => m.CommunicationComponent,
          ),
      },
      {
        path: 'fees',
        loadComponent: () => import('./features/fees/fees.component').then((m) => m.FeesComponent),
      },
      {
        path: 'materials',
        loadComponent: () =>
          import('./features/content/content.component').then((m) => m.ContentComponent),
      },
      {
        path: 'lectures',
        loadComponent: () =>
          import('./features/content/content.component').then((m) => m.ContentComponent),
      },
    ],
  },
  {
    path: 'teacher',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Teacher Portal', navItems: teacherNav },
    canActivate: [authGuard, roleGuard([UserRole.Teacher])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'attendance' },
      {
        path: 'attendance',
        loadComponent: () =>
          import('./features/teacher/attendance/teacher-attendance.component').then(
            (m) => m.TeacherAttendanceComponent,
          ),
      },
      {
        path: 'marks',
        loadComponent: () =>
          import('./features/teacher/marks/teacher-marks.component').then((m) => m.TeacherMarksComponent),
      },
    ],
  },
  {
    path: 'coordinator',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Coordinator Portal', navItems: coordinatorNav },
    canActivate: [authGuard, roleGuard([UserRole.Coordinator])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'subject-requests' },
      {
        path: 'subject-requests',
        loadComponent: () =>
          import('./features/coordinator/subject-requests/coordinator-subject-requests.component').then(
            (m) => m.CoordinatorSubjectRequestsComponent,
          ),
      },
      {
        path: 'teacher-attendance',
        loadComponent: () =>
          import('./features/coordinator/teacher-attendance/coordinator-teacher-attendance.component').then(
            (m) => m.CoordinatorTeacherAttendanceComponent,
          ),
      },
      {
        path: 'grades',
        loadComponent: () =>
          import('./features/coordinator/grades/coordinator-grades.component').then(
            (m) => m.CoordinatorGradesComponent,
          ),
      },
      {
        path: 'fees-review',
        loadComponent: () =>
          import('./features/admin-fees/admin-fee-review.component').then(
            (m) => m.AdminFeeReviewComponent,
          ),
      },
      {
        path: 'registry',
        loadComponent: () =>
          import('./features/admin/registry/admin-registry.component').then(
            (m) => m.AdminRegistryComponent,
          ),
      },
    ],
  },
  {
    path: 'admin',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Admin Portal', navItems: adminNav },
    canActivate: [authGuard, roleGuard([UserRole.Admin])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'registry' },
      {
        path: 'registry',
        loadComponent: () =>
          import('./features/admin/registry/admin-registry.component').then(
            (m) => m.AdminRegistryComponent,
          ),
      },
    ],
  },
  {
    path: 'parent',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Parent Portal', navItems: parentNav },
    canActivate: [authGuard, roleGuard([UserRole.Parent])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/parent/dashboard/parent-dashboard.component').then(
            (m) => m.ParentDashboardComponent,
          ),
      },
      {
        path: 'report-card',
        loadComponent: () =>
          import('./features/parent/report-card/parent-report-card.component').then(
            (m) => m.ParentReportCardComponent,
          ),
      },
      {
        path: 'fees',
        loadComponent: () =>
          import('./features/parent/fees/parent-fees.component').then((m) => m.ParentFeesComponent),
      },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./features/parent/complaints/parent-complaints.component').then(
            (m) => m.ParentComplaintsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];