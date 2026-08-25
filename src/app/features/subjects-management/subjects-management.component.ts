import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';

import { AdminSubjectsComponent } from '../admin/subjects/admin-subjects.component';
import { CoordinatorSubjectRequestsComponent } from '../coordinator/subject-requests/coordinator-subject-requests.component';

/**
 * Consolidated "Subjects" management page for the Admin and Coordinator
 * portals.
 *
 * Previously "Subjects" (catalog CRUD, admin-only nav entry at
 * /admin/subjects) and "Subject Requests" (its own nav entry in BOTH
 * portals) were separate pages. They're now one "Subjects" page with
 * two tabs: "Subjects Catalog" and "Subject Requests".
 *
 * Design choice, consistent with the other consolidated pages in this
 * app (FeeManagementComponent, MarksAssessmentsComponent,
 * NotesLecturesComponent): a thin composition shell, not a merge of
 * both feature components' logic into one class.
 * CoordinatorSubjectRequestsComponent was already role-agnostic (both
 * portals already loaded it). AdminSubjectsComponent was NOT — its
 * Edit/Activate-Deactivate/Delete mutations are admin-only server-side
 * (app/routers/subjects.py), so before reusing it here for Coordinator
 * too, it was updated with an `isAdmin` computed signal (same pattern
 * as AdminRegistryComponent.isAdmin) that hides those three actions for
 * a Coordinator viewer rather than showing buttons that would 403 —
 * see that component's own docstring. List + Add Subject already work
 * for both roles server-side (GET/POST on /api/academic/subjects), so
 * neither needed gating.
 *
 * p-tabView only renders a panel's content once that tab has been
 * opened, so neither tab's data is fetched until the user actually
 * looks at it.
 *
 * Tab switching logic: the active tab is mirrored to a `?tab=` query
 * param (`catalog` | `requests`) rather than left as pure internal
 * p-tabView state, so a specific tab is deep-linkable (e.g. a
 * notification linking straight to a pending subject request) and
 * survives a page refresh. `replaceUrl: true` keeps tab switches out
 * of browser history.
 */
@Component({
  selector: 'app-subjects-management',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TabViewModule,
    AdminSubjectsComponent,
    CoordinatorSubjectRequestsComponent,
  ],
  templateUrl: './subjects-management.component.html',
  styleUrl: './subjects-management.component.scss',
})
export class SubjectsManagementComponent {
  private static readonly TAB_INDEX_BY_PARAM: Record<string, number> = {
    catalog: 0,
    requests: 1,
  };
  private static readonly TAB_PARAM_BY_INDEX = ['catalog', 'requests'];

  /** 0 = Subjects Catalog, 1 = Subject Requests. Defaults to the first
   *  tab when there's no (or an unrecognized) ?tab= param. */
  activeTabIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTabIndex = requestedTab
      ? (SubjectsManagementComponent.TAB_INDEX_BY_PARAM[requestedTab] ?? 0)
      : 0;
  }

  /** Bound to p-tabView's (activeIndexChange) rather than (onChange) —
   *  a plain number in/out is stable across PrimeNG versions, whereas
   *  the onChange event payload shape has moved between majors. */
  onTabIndexChange(index: number): void {
    this.activeTabIndex = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: SubjectsManagementComponent.TAB_PARAM_BY_INDEX[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
