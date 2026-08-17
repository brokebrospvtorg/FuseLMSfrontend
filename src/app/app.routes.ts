import { Routes } from '@angular/router';
import { PortalLayoutComponent, PortalNavItem } from './shared/layout/portal-layout/portal-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { teacherGuard } from './core/guards/teacher.guard';
import { UserRole } from './core/models/enums';

const teacherNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/teacher/dashboard' },
  { label: 'Attendance', icon: 'attendance', route: '/teacher/attendance' },
  { label: 'Marks & Assignments', icon: 'grades', route: '/teacher/marks' },
  { label: 'Timetable', icon: 'timetable', route: '/teacher/timetable' },
  { label: 'Lectures & Notes', icon: 'lectures', route: '/teacher/lectures-notes' },
  { label: 'Feedback', icon: 'complaints', route: '/teacher/feedback' },
];

const coordinatorNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/coordinator/dashboard' },
  { label: 'Subject Requests', icon: 'subject-requests', route: '/coordinator/subject-requests' },
  { label: 'Teacher Attendance', icon: 'attendance', route: '/coordinator/teacher-attendance' },
  { label: 'Student Attendance', icon: 'attendance', route: '/coordinator/student-attendance' },
  { label: 'Timetable', icon: 'timetable', route: '/coordinator/timetable' },
  { label: 'Grade Overrides', icon: 'grades', route: '/coordinator/grades' },
  { label: 'Marks & Assessments', icon: 'grades', route: '/coordinator/marks-management' },
  { label: 'Mark Edit Requests', icon: 'grades', route: '/coordinator/mark-edit-requests' },
  { label: 'Classroom Requests', icon: 'lectures', route: '/coordinator/classroom-requests' },
  { label: 'Video Requests', icon: 'lectures', route: '/coordinator/youtube-requests' },
  { label: 'Fee Proofs', icon: 'fees', route: '/coordinator/fees-review' },
  { label: 'Complaints', icon: 'complaints', route: '/coordinator/complaints' },
  { label: 'Information Registry', icon: 'registry', route: '/coordinator/registry' },
];

const adminNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard', section: 'System Administration' },
  { label: 'Information Registry', icon: 'registry', route: '/admin/registry', section: 'Information Registry' },
  { label: 'Subject Requests', icon: 'subject-requests', route: '/admin/subject-requests', section: 'Academics' },
  { label: 'Timetable', icon: 'timetable', route: '/admin/timetable', section: 'Academics' },
  { label: 'Grade Overrides', icon: 'grades', route: '/admin/grades', section: 'Academics' },
  { label: 'Marks & Assessments', icon: 'grades', route: '/admin/marks-management', section: 'Academics' },
  { label: 'Mark Edit Requests', icon: 'grades', route: '/admin/mark-edit-requests', section: 'Academics' },
  { label: 'Classroom Requests', icon: 'lectures', route: '/admin/classroom-requests', section: 'Academics' },
  { label: 'Video Requests', icon: 'lectures', route: '/admin/youtube-requests', section: 'Academics' },
  { label: 'Teacher Attendance', icon: 'attendance', route: '/admin/teacher-attendance', section: 'Operations' },
  { label: 'Student Attendance', icon: 'attendance', route: '/admin/student-attendance', section: 'Operations' },
  { label: 'Fee Structures', icon: 'fees', route: '/admin/fee-structures', section: 'Operations' },
  { label: 'Fee Proofs', icon: 'fees', route: '/admin/fees-review', section: 'Operations' },
  { label: 'Complaints', icon: 'complaints', route: '/admin/complaints', section: 'Operations' },
  { label: 'Notifications', icon: 'complaints', route: '/admin/notifications', section: 'Operations' },
];

const parentNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/parent/dashboard' },
  { label: 'Attendance', icon: 'attendance', route: '/parent/attendance' },
  { label: 'Timetable', icon: 'timetable', route: '/parent/timetable' },
  { label: 'Report Card', icon: 'grades', route: '/parent/report-card' },
  { label: 'Subject Requests', icon: 'subject-requests', route: '/parent/subject-requests' },
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
    canActivate: [authGuard, teacherGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        // Sub-Sprint 2.1
        path: 'dashboard',
        loadComponent: () =>
          import('./features/teacher/dashboard/teacher-dashboard.component').then(
            (m) => m.TeacherDashboardComponent,
          ),
      },
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
      {
        // Sub-Sprint 6.1
        path: 'timetable',
        loadComponent: () =>
          import('./features/teacher/timetable/teacher-timetable.component').then(
            (m) => m.TeacherTimetableComponent,
          ),
      },
      {
        // Sub-Sprint 2.2 — two coming-soon sections (YouTube + GCR),
        // this IS the finished state of this screen until Sprint 9.
        path: 'lectures-notes',
        loadComponent: () =>
          import('./features/teacher/lectures-notes/teacher-lectures-notes.component').then(
            (m) => m.TeacherLecturesNotesComponent,
          ),
      },
      {
        // Sub-Sprint 6.2
        path: 'feedback',
        loadComponent: () =>
          import('./features/teacher/feedback/teacher-feedback.component').then(
            (m) => m.TeacherFeedbackComponent,
          ),
      },
    ],
  },
  {
    path: 'coordinator',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Coordinator Portal', navItems: coordinatorNav },
    canActivate: [authGuard, roleGuard([UserRole.Coordinator])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/coordinator/dashboard/coordinator-dashboard.component').then(
            (m) => m.CoordinatorDashboardComponent,
          ),
      },
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
        path: 'student-attendance',
        loadComponent: () =>
          import('./features/coordinator/student-attendance/coordinator-student-attendance.component').then(
            (m) => m.CoordinatorStudentAttendanceComponent,
          ),
      },
      {
        path: 'timetable',
        loadComponent: () =>
          import('./features/coordinator/timetable/coordinator-timetable.component').then(
            (m) => m.CoordinatorTimetableComponent,
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
        path: 'marks-management',
        loadComponent: () =>
          import('./features/coordinator/marks-management/coordinator-marks-management.component').then(
            (m) => m.CoordinatorMarksManagementComponent,
          ),
      },
      {
        path: 'mark-edit-requests',
        loadComponent: () =>
          import('./features/coordinator/mark-edit-requests/coordinator-mark-edit-requests.component').then(
            (m) => m.CoordinatorMarkEditRequestsComponent,
          ),
      },
      {
        path: 'classroom-requests',
        loadComponent: () =>
          import('./features/coordinator/classroom-requests/coordinator-classroom-requests.component').then(
            (m) => m.CoordinatorClassroomRequestsComponent,
          ),
      },
      {
        path: 'youtube-requests',
        loadComponent: () =>
          import('./features/coordinator/youtube-requests/coordinator-youtube-requests.component').then(
            (m) => m.CoordinatorYoutubeRequestsComponent,
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
        path: 'complaints',
        loadComponent: () =>
          import('./features/coordinator/complaints/coordinator-complaints.component').then(
            (m) => m.CoordinatorComplaintsComponent,
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
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        // Sub-Sprint 2
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'registry',
        loadComponent: () =>
          import('./features/admin/registry/admin-registry.component').then(
            (m) => m.AdminRegistryComponent,
          ),
      },
      {
        // Reuses the Coordinator's component — both roles are already
        // allowed server-side (GET/POST/PATCH .../subject-requests...),
        // same pattern as Registry/Fee Proofs below.
        path: 'subject-requests',
        loadComponent: () =>
          import('./features/coordinator/subject-requests/coordinator-subject-requests.component').then(
            (m) => m.CoordinatorSubjectRequestsComponent,
          ),
      },
      {
        // Reuses the Coordinator's Interactive Timetable Builder — POST/PATCH/DELETE
        // /api/timetable/slots are already role-gated to admin+coordinator.
        path: 'timetable',
        loadComponent: () =>
          import('./features/coordinator/timetable/coordinator-timetable.component').then(
            (m) => m.CoordinatorTimetableComponent,
          ),
      },
      {
        // Reuses the Coordinator's Grade Overrides screen (class average +
        // grade distribution + override, all admin+coordinator gated server-side).
        path: 'grades',
        loadComponent: () =>
          import('./features/coordinator/grades/coordinator-grades.component').then(
            (m) => m.CoordinatorGradesComponent,
          ),
      },
      {
        // Reuses the Coordinator's direct create/edit/delete of assessments
        // & marks — same admin+coordinator gate as everything else here.
        path: 'marks-management',
        loadComponent: () =>
          import('./features/coordinator/marks-management/coordinator-marks-management.component').then(
            (m) => m.CoordinatorMarksManagementComponent,
          ),
      },
      {
        // Reuses the Coordinator's component — both roles are already
        // allowed server-side (GET/PATCH /marks/edit-requests/pending,
        // .../{id}), same pattern as Registry/Fee Proofs below.
        path: 'mark-edit-requests',
        loadComponent: () =>
          import('./features/coordinator/mark-edit-requests/coordinator-mark-edit-requests.component').then(
            (m) => m.CoordinatorMarkEditRequestsComponent,
          ),
      },
      {
        // Same reuse pattern — GET/PATCH /api/classroom-requests is
        // admin/coordinator both, backend-side.
        path: 'classroom-requests',
        loadComponent: () =>
          import('./features/coordinator/classroom-requests/coordinator-classroom-requests.component').then(
            (m) => m.CoordinatorClassroomRequestsComponent,
          ),
      },
      {
        // Same reuse pattern — GET/PATCH /api/youtube-requests is
        // admin/coordinator both, backend-side.
        path: 'youtube-requests',
        loadComponent: () =>
          import('./features/coordinator/youtube-requests/coordinator-youtube-requests.component').then(
            (m) => m.CoordinatorYoutubeRequestsComponent,
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
        // Reuses the Coordinator's teacher-attendance mark/override screen
        // — already admin+coordinator gated server-side (Sub-Sprint 3).
        path: 'teacher-attendance',
        loadComponent: () =>
          import('./features/coordinator/teacher-attendance/coordinator-teacher-attendance.component').then(
            (m) => m.CoordinatorTeacherAttendanceComponent,
          ),
      },
      {
        // Reuses the Coordinator's student-attendance override screen —
        // same admin+coordinator gate (Sub-Sprint 3's "bypass the teacher lock").
        path: 'student-attendance',
        loadComponent: () =>
          import('./features/coordinator/student-attendance/coordinator-student-attendance.component').then(
            (m) => m.CoordinatorStudentAttendanceComponent,
          ),
      },
      {
        // Reuses the Coordinator's Complaints Resolution Center — Pending/
        // Solved/Closed workflow, already admin+coordinator gated.
        path: 'complaints',
        loadComponent: () =>
          import('./features/coordinator/complaints/coordinator-complaints.component').then(
            (m) => m.CoordinatorComplaintsComponent,
          ),
      },
      {
        // New in Admin Sub-Sprint 4: fee_structures table existed since an
        // early schema migration but had zero backend or frontend — this
        // is the first screen that actually uses it.
        path: 'fee-structures',
        loadComponent: () =>
          import('./features/admin/fee-structures/admin-fee-structures.component').then(
            (m) => m.AdminFeeStructuresComponent,
          ),
      },
      {
        // New in Admin Sub-Sprint 4: broadcast notifications (all
        // notifications before this were single-user, triggered by an
        // action — this is the first one-to-many "announcement" path.
        path: 'notifications',
        loadComponent: () =>
          import('./features/admin/notifications/admin-notifications.component').then(
            (m) => m.AdminNotificationsComponent,
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
        path: 'attendance',
        loadComponent: () =>
          import('./features/parent/attendance/parent-attendance.component').then(
            (m) => m.ParentAttendanceComponent,
          ),
      },
      {
        path: 'timetable',
        loadComponent: () =>
          import('./features/parent/timetable/parent-timetable.component').then(
            (m) => m.ParentTimetableComponent,
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
        path: 'subject-requests',
        loadComponent: () =>
          import('./features/parent/subject-requests/parent-subject-request.component').then(
            (m) => m.ParentSubjectRequestComponent,
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