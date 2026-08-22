import { Injectable, computed, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';

import { AuthService } from './auth.service';
import { AcademicsStaffService } from './academics-staff.service';
import { UserRole } from '../models/enums';
import { ActivePortalRole, TeacherAssignmentSummary } from '../models/role-switch.model';

const ACTIVE_PORTAL_ROLE_STORAGE_KEY = 'fuse.roleSwitch.activePortalRole';

/**
 * Shared "which portal shell is a dual-role account currently looking
 * at" state — same rationale as ParentContextService: this needs to
 * survive navigating between pages within a portal, not just live on
 * one component.
 *
 * IMPORTANT — what this service does and does NOT do:
 * It decides whether the Coordinator/Teacher switcher renders at all,
 * and which route tree ("/teacher/**" vs "/coordinator/**") the person
 * is sent to when they flip it, and (via checkTeacherPortalEligibility)
 * backs the route guard that protects "/teacher/**" from a plain
 * Coordinator typing the URL directly. It does NOT and CANNOT grant API
 * access on its own — every Teacher-scoped endpoint is still gated
 * server-side by require_roles(...) against the account's actual DB
 * role column, not anything this service's signal says. This is by
 * design: a switch here only ever changes nav/URL, never authorization.
 *
 * Backend status: every Teacher-portal write/read endpoint a dual-role
 * Coordinator needs already accepts "coordinator" alongside "teacher"
 * (POST /api/attendance/mark-students, GET /api/timetable/my-teaching-schedule,
 * POST /api/academics/marks/{mark_id}/edit-requests, GET
 * /api/academics/marks/edit-requests/mine, and the general marks
 * upload/roster endpoints) — each one still scopes results/writes to
 * rows the account itself owns (slot.teacher_id, requested_by, etc.),
 * so a dual-role Coordinator only ever touches what a real Teacher
 * account touching the same record could. The one deliberate exception
 * is the classroom-link/YouTube-link "set once, then request an edit"
 * endpoints in content.py — those stay Teacher-only by design (a
 * self-service content-ownership workflow, unrelated to this switch),
 * not because dual-role support is missing there.
 */
@Injectable({ providedIn: 'root' })
export class RoleSwitchService {
  private readonly _teacherAssignments = signal<TeacherAssignmentSummary[]>([]);
  private readonly _assignmentsLoading = signal(false);
  private readonly _assignmentsError = signal<string | null>(null);
  private readonly _activePortalRole = signal<ActivePortalRole>(ActivePortalRole.Coordinator);

  /** Memoized (shareReplay) so the switcher's ensureLoaded() and the
   *  route guard's checkTeacherPortalEligibility() — which can both fire
   *  around the same time on a fresh page load into /teacher/** — share
   *  one HTTP round trip instead of racing two. */
  private assignments$: Observable<TeacherAssignmentSummary[]> | null = null;

  readonly assignmentsLoading = this._assignmentsLoading.asReadonly();
  readonly assignmentsError = this._assignmentsError.asReadonly();
  readonly activePortalRole = this._activePortalRole.asReadonly();

  /**
   * True only for a Coordinator account that also has at least one
   * non-deleted TeacherSubjectAssignment row. Everyone else (a plain
   * Coordinator, a plain Teacher, Admin/Student/Parent) never sees the
   * switcher — this is deliberately narrower than "is a Coordinator",
   * per the requirement ("Coordinators who are also assigned as
   * Teachers"). Reflects whatever ensureLoaded()/checkTeacherPortalEligibility()
   * last resolved — false (switcher hidden) until one of them has run.
   */
  readonly isDualRole = computed(
    () => this.authService.currentUser()?.role === UserRole.Coordinator && this._teacherAssignments().length > 0,
  );

  constructor(
    private authService: AuthService,
    private academicsStaffService: AcademicsStaffService,
  ) {}

  private loadAssignments(): Observable<TeacherAssignmentSummary[]> {
    if (this.assignments$) return this.assignments$;

    const user = this.authService.currentUser();
    if (!user || user.role !== UserRole.Coordinator) {
      this.assignments$ = of([]);
      return this.assignments$;
    }

    this._assignmentsLoading.set(true);
    this.assignments$ = this.academicsStaffService.getTeacherAssignmentsFor(user.id).pipe(
      tap({
        next: (assignments) => {
          this._teacherAssignments.set(assignments);
          this._assignmentsLoading.set(false);

          const stored = sessionStorage.getItem(ACTIVE_PORTAL_ROLE_STORAGE_KEY);
          if (assignments.length > 0 && stored === ActivePortalRole.Teacher) {
            this._activePortalRole.set(ActivePortalRole.Teacher);
          }
        },
      }),
      catchError(() => {
        // Fails soft: the switcher just doesn't appear and the guard
        // denies entry. A Coordinator who genuinely has no teaching
        // assignments and one whose lookup happened to fail should look
        // the same to them — either way there's nothing actionable for
        // them to do about it in the moment.
        this._assignmentsLoading.set(false);
        this._assignmentsError.set('Could not check for a linked Teacher assignment.');
        return of([] as TeacherAssignmentSummary[]);
      }),
      shareReplay(1),
    );
    return this.assignments$;
  }

  /**
   * Safe to call from portal-layout's ngOnInit every time it mounts —
   * fetches at most once per session (subsequent calls reuse the
   * memoized assignments$). A no-op for any account whose role isn't
   * Coordinator, since only a Coordinator can ever be dual-role here.
   */
  ensureLoaded(): void {
    this.loadAssignments().subscribe();
  }

  /**
   * Used by teacherPortalGuard: resolves true if this account is
   * entitled to be inside "/teacher/**" — either a real Teacher account,
   * or a Coordinator with at least one teaching assignment. Shares the
   * same memoized lookup ensureLoaded() uses, so landing on
   * /teacher/dashboard via a fresh URL (guard fires before portal-layout
   * has mounted) doesn't cost a second request once portal-layout's own
   * ensureLoaded() runs a moment later.
   */
  checkTeacherPortalEligibility(): Observable<boolean> {
    const user = this.authService.currentUser();
    if (user?.role === UserRole.Teacher) return of(true);
    if (user?.role !== UserRole.Coordinator) return of(false);

    return this.loadAssignments().pipe(map((assignments) => assignments.length > 0));
  }

  /**
   * Switches the active portal role and persists the choice
   * (sessionStorage, same "survive a refresh, not a new login" scope as
   * ParentContextService's selected child) — then returns the route
   * path the caller should navigate to. Returning the path rather than
   * navigating directly keeps this service router-agnostic and easy to
   * unit test; the switcher component does the actual router.navigate(...).
   */
  switchTo(role: ActivePortalRole): string {
    this._activePortalRole.set(role);
    sessionStorage.setItem(ACTIVE_PORTAL_ROLE_STORAGE_KEY, role);
    return role === ActivePortalRole.Teacher ? '/teacher/dashboard' : '/coordinator/dashboard';
  }
}