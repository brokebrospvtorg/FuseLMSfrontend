import { Routes } from '@angular/router';
import { PortalLayoutComponent, PortalNavItem } from './shared/layout/portal-layout/portal-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { teacherPortalGuard } from './core/guards/teacher-portal.guard';
import { mustChangePasswordGuard } from './core/guards/must-change-password.guard';
import { changePasswordPageGuard } from './core/guards/change-password-page.guard';
import { UserRole } from './core/models/enums';

const teacherNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/teacher/dashboard' },
  { label: 'Attendance', icon: 'attendance', route: '/teacher/attendance' },
  { label: 'Marks & Assignments', icon: 'grades', route: '/teacher/marks' },
  { label: 'Timetable', icon: 'timetable', route: '/teacher/timetable' },
  { label: 'Lectures & Notes', icon: 'lectures', route: '/teacher/lectures-notes' },
  { label: 'Feedback', icon: 'complaints', route: '/teacher/feedback' },
  { label: 'Notifications', icon: 'notifications', route: '/teacher/notifications' },
];

const coordinatorNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/coordinator/dashboard' },
  // Academics group — Batches and Teachers kept as the first, adjacent pair
  // (same convention as adminNav's 'Academics' section below) since they're
  // the two most-used management screens for this role.
  { label: 'Batches', icon: 'registry', route: '/coordinator/batches', section: 'Academics' },
  { label: 'Teachers', icon: 'teachers', route: '/coordinator/teachers', section: 'Academics' },
  { label: 'Subjects', icon: 'subject-requests', route: '/coordinator/subjects', section: 'Academics' },
  { label: 'Timetable', icon: 'timetable', route: '/coordinator/timetable', section: 'Academics' },
  { label: 'Marks & Assessments', icon: 'grades', route: '/coordinator/marks-assessments', section: 'Academics' },
  { label: 'Notes & Lectures', icon: 'lectures', route: '/coordinator/lectures-notes', section: 'Academics' },
  { label: 'Attendance', icon: 'attendance', route: '/coordinator/attendance', section: 'Operations' },
  { label: 'Fee Management', icon: 'fees', route: '/coordinator/fee-management', section: 'Operations' },
  { label: 'Complaints', icon: 'complaints', route: '/coordinator/complaints', section: 'Operations' },
  { label: 'Information Registry', icon: 'registry', route: '/coordinator/registry' },
  { label: 'Notifications', icon: 'notifications', route: '/coordinator/notifications' },
];

const adminNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard', section: 'System Administration' },
  { label: 'Information Registry', icon: 'registry', route: '/admin/registry', section: 'Information Registry' },
  { label: 'Batches', icon: 'registry', route: '/admin/batches', section: 'Academics' },
  { label: 'Teachers', icon: 'teachers', route: '/admin/teachers', section: 'Academics' },
  { label: 'Subjects', icon: 'subject-requests', route: '/admin/subjects', section: 'Academics' },
  { label: 'Timetable', icon: 'timetable', route: '/admin/timetable', section: 'Academics' },
  { label: 'Marks & Assessments', icon: 'grades', route: '/admin/marks-assessments', section: 'Academics' },
  { label: 'Notes & Lectures', icon: 'lectures', route: '/admin/lectures-notes', section: 'Academics' },
  { label: 'Attendance', icon: 'attendance', route: '/admin/attendance', section: 'Operations' },
  { label: 'Fee Management', icon: 'fees', route: '/admin/fee-management', section: 'Operations' },
  { label: 'Complaints', icon: 'complaints', route: '/admin/complaints', section: 'Operations' },
  // Route unchanged — AdminNotificationsComponent now embeds the same
  // unified <app-notifications> list every other role's sidebar link
  // points to (see NotificationsComponent), above its existing broadcast
  // composer, so this one entry covers both "view my notifications" and
  // "send a notification" instead of splitting into two nav items.
  { label: 'Notifications', icon: 'notifications', route: '/admin/notifications', section: 'Operations' },
  { label: 'Password Requests', icon: 'password-requests', route: '/admin/password-requests', section: 'Operations' },
];

const parentNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/parent/dashboard' },
  { label: 'Attendance', icon: 'attendance', route: '/parent/attendance' },
  { label: 'Timetable', icon: 'timetable', route: '/parent/timetable' },
  { label: 'Report Card', icon: 'grades', route: '/parent/report-card' },
  { label: 'Subject Requests', icon: 'subject-requests', route: '/parent/subject-requests' },
  { label: 'Fee Ledger', icon: 'fees', route: '/parent/fees' },
  { label: 'Complaints', icon: 'complaints', route: '/parent/complaints' },
  { label: 'Notifications', icon: 'notifications', route: '/parent/notifications' },
];

const studentNav: PortalNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/student/dashboard' },
  { label: 'Attendance Report', icon: 'attendance', route: '/student/attendance' },
  { label: 'Timetable', icon: 'timetable', route: '/student/timetable' },
  { label: 'Grades Report', icon: 'grades', route: '/student/grades' },
  { label: 'Feedback/Complaints', icon: 'complaints', route: '/student/complaints' },
  { label: 'Fee System', icon: 'fees', route: '/student/fees' },
  { label: 'LMS & Study Resources', icon: 'materials', route: '/student/materials' },
  { label: 'Lectures', icon: 'lectures', route: '/student/lectures' },
  { label: 'Notifications', icon: 'notifications', route: '/student/notifications' },
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard, changePasswordPageGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
  },
  {
    path: 'student',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Student Portal', navItems: studentNav },
    canActivate: [authGuard, mustChangePasswordGuard, roleGuard([UserRole.Student])],
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
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
      {
        path: 'fees',
        loadComponent: () => import('./features/fees/fees.component').then((m) => m.FeesComponent),
      },
      {
        path: 'materials',
        loadComponent: () =>
          import('./features/content/google-classroom/google-classroom.component').then(
            (m) => m.GoogleClassroomComponent,
          ),
      },
      {
        path: 'lectures',
        loadComponent: () =>
          import('./features/content/lectures-catalog/lectures-catalog.component').then(
            (m) => m.LecturesCatalogComponent,
          ),
      },
    ],
  },
  {
    path: 'teacher',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Teacher Portal', navItems: teacherNav },
    canActivate: [authGuard, mustChangePasswordGuard, teacherPortalGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
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
        path: 'timetable',
        loadComponent: () =>
          import('./features/teacher/timetable/teacher-timetable.component').then(
            (m) => m.TeacherTimetableComponent,
          ),
      },
      {
        path: 'lectures-notes',
        loadComponent: () =>
          import('./features/teacher/lectures-notes/teacher-lectures-notes.component').then(
            (m) => m.TeacherLecturesNotesComponent,
          ),
      },
      {
        path: 'feedback',
        loadComponent: () =>
          import('./features/teacher/feedback/teacher-feedback.component').then(
            (m) => m.TeacherFeedbackComponent,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
    ],
  },
  {
    path: 'coordinator',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Coordinator Portal', navItems: coordinatorNav },
    canActivate: [authGuard, mustChangePasswordGuard, roleGuard([UserRole.Coordinator])],
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
        path: 'batches',
        loadComponent: () =>
          import('./features/academic/academics-management/academics-management.component').then(
            (m) => m.AcademicsManagementComponent,
          ),
      },
      {
        path: 'teachers',
        loadComponent: () =>
          import('./features/admin/teachers/admin-teachers.component').then(
            (m) => m.AdminTeachersComponent,
          ),
      },
      {
        path: 'subjects',
        loadComponent: () =>
          import('./features/subjects-management/subjects-management.component').then(
            (m) => m.SubjectsManagementComponent,
          ),
      },
      { path: 'subject-requests', redirectTo: 'subjects', pathMatch: 'full' },
      {
        path: 'attendance',
        data: { role: 'coordinator' },
        loadComponent: () =>
          import('./features/attendance-management/attendance-management.component').then(
            (m) => m.AttendanceManagementComponent,
          ),
      },
      { path: 'teacher-attendance', redirectTo: 'attendance', pathMatch: 'full' },
      { path: 'student-attendance', redirectTo: 'attendance', pathMatch: 'full' },
      {
        path: 'timetable',
        loadComponent: () =>
          import('./features/coordinator/timetable/coordinator-timetable.component').then(
            (m) => m.CoordinatorTimetableComponent,
          ),
      },
      {
        path: 'marks-assessments',
        loadComponent: () =>
          import('./features/marks-assessments/marks-assessments.component').then(
            (m) => m.MarksAssessmentsComponent,
          ),
      },
      { path: 'grades', redirectTo: 'marks-assessments', pathMatch: 'full' },
      { path: 'marks-management', redirectTo: 'marks-assessments', pathMatch: 'full' },
      { path: 'mark-edit-requests', redirectTo: 'marks-assessments', pathMatch: 'full' },
      {
        path: 'lectures-notes',
        loadComponent: () =>
          import('./features/notes-lectures/notes-lectures.component').then(
            (m) => m.NotesLecturesComponent,
          ),
      },
      { path: 'classroom-requests', redirectTo: 'lectures-notes', pathMatch: 'full' },
      { path: 'youtube-requests', redirectTo: 'lectures-notes', pathMatch: 'full' },
      {
        path: 'fee-management',
        loadComponent: () =>
          import('./features/fee-management/fee-management.component').then(
            (m) => m.FeeManagementComponent,
          ),
      },
      // Old direct links to either half of the merged page above still
      // resolve, redirected to the matching tab.
      { path: 'fee-structures', redirectTo: 'fee-management', pathMatch: 'full' },
      { path: 'fees-review', redirectTo: 'fee-management', pathMatch: 'full' },
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
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
    ],
  },
  {
    path: 'admin',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Admin Portal', navItems: adminNav },
    canActivate: [authGuard, mustChangePasswordGuard, roleGuard([UserRole.Admin])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
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
        path: 'batches',
        loadComponent: () =>
          import('./features/academic/academics-management/academics-management.component').then(
            (m) => m.AcademicsManagementComponent,
          ),
      },
      {
        path: 'teachers',
        loadComponent: () =>
          import('./features/admin/teachers/admin-teachers.component').then(
            (m) => m.AdminTeachersComponent,
          ),
      },
      {
        path: 'subjects',
        loadComponent: () =>
          import('./features/subjects-management/subjects-management.component').then(
            (m) => m.SubjectsManagementComponent,
          ),
      },
      { path: 'subject-requests', redirectTo: 'subjects', pathMatch: 'full' },
      {
        path: 'timetable',
        loadComponent: () =>
          import('./features/coordinator/timetable/coordinator-timetable.component').then(
            (m) => m.CoordinatorTimetableComponent,
          ),
      },
      {
        path: 'marks-assessments',
        loadComponent: () =>
          import('./features/marks-assessments/marks-assessments.component').then(
            (m) => m.MarksAssessmentsComponent,
          ),
      },
      { path: 'grades', redirectTo: 'marks-assessments', pathMatch: 'full' },
      { path: 'marks-management', redirectTo: 'marks-assessments', pathMatch: 'full' },
      { path: 'mark-edit-requests', redirectTo: 'marks-assessments', pathMatch: 'full' },
      {
        path: 'lectures-notes',
        loadComponent: () =>
          import('./features/notes-lectures/notes-lectures.component').then(
            (m) => m.NotesLecturesComponent,
          ),
      },
      { path: 'classroom-requests', redirectTo: 'lectures-notes', pathMatch: 'full' },
      { path: 'youtube-requests', redirectTo: 'lectures-notes', pathMatch: 'full' },
      {
        path: 'attendance',
        data: { role: 'admin' },
        loadComponent: () =>
          import('./features/attendance-management/attendance-management.component').then(
            (m) => m.AttendanceManagementComponent,
          ),
      },
      { path: 'teacher-attendance', redirectTo: 'attendance', pathMatch: 'full' },
      { path: 'student-attendance', redirectTo: 'attendance', pathMatch: 'full' },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./features/coordinator/complaints/coordinator-complaints.component').then(
            (m) => m.CoordinatorComplaintsComponent,
          ),
      },
      {
        path: 'fee-management',
        loadComponent: () =>
          import('./features/fee-management/fee-management.component').then(
            (m) => m.FeeManagementComponent,
          ),
      },
      { path: 'fee-structures', redirectTo: 'fee-management', pathMatch: 'full' },
      { path: 'fees-review', redirectTo: 'fee-management', pathMatch: 'full' },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/admin/notifications/admin-notifications.component').then(
            (m) => m.AdminNotificationsComponent,
          ),
      },
      {
        path: 'password-requests',
        loadComponent: () =>
          import('./features/admin/password-requests/admin-password-requests.component').then(
            (m) => m.AdminPasswordRequestsComponent,
          ),
      },
    ],
  },
  {
    path: 'parent',
    component: PortalLayoutComponent,
    data: { portalTitle: 'Parent Portal', navItems: parentNav },
    canActivate: [authGuard, mustChangePasswordGuard, roleGuard([UserRole.Parent])],
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
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];