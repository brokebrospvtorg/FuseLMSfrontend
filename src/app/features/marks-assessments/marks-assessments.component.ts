import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';

import { CoordinatorMarksManagementComponent } from '../coordinator/marks-management/coordinator-marks-management.component';
import { CoordinatorMarkEditRequestsComponent } from '../coordinator/mark-edit-requests/coordinator-mark-edit-requests.component';
import { CoordinatorMarkOverrideComponent } from '../coordinator/grades/coordinator-grades.component';

/**
 * Consolidated "Marks & Assessments" page for the Admin and Coordinator
 * portals.
 *
 * Three previously-separate sidebar entries — "Marks & Assessments"
 * (assessment/mark entry, bypassing the Teacher lock),
 * "Mark Edit Requests" (the review queue for Teacher-submitted edit
 * requests), and "Grade Overrides" (direct per-student mark override
 * with an audit trail) — are now one page with three tabs.
 *
 * Design choice, same as FeeManagementComponent: this is a thin
 * composition shell, not a merge of three feature components' logic
 * into one class. CoordinatorMarksManagementComponent,
 * CoordinatorMarkEditRequestsComponent, and CoordinatorMarkOverrideComponent
 * (the file is coordinator-grades.component.ts, but its exported class
 * is CoordinatorMarkOverrideComponent) are already fully self-contained standalone components — despite the
 * "Coordinator" prefix they're already role-agnostic (both the /admin
 * and /coordinator route blocks load the exact same three classes; see
 * app.routes.ts), and each keeps its own signals/dialogs/services
 * untouched here. p-tabView only renders a panel's content once that
 * tab has been opened, so no tab's data is fetched until the user
 * actually looks at it, and none of the three's state can leak into
 * another's.
 *
 * Tab switching logic: the active tab is mirrored to a `?tab=` query
 * param (`assessments` | `edit-requests` | `overrides`) rather than
 * left as pure internal p-tabView state, so a specific tab is
 * deep-linkable (e.g. a notification linking straight to a pending
 * mark-edit request) and survives a page refresh. `replaceUrl: true`
 * keeps tab switches out of browser history.
 */
@Component({
  selector: 'app-marks-assessments',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TabViewModule,
    CoordinatorMarksManagementComponent,
    CoordinatorMarkEditRequestsComponent,
    CoordinatorMarkOverrideComponent,
  ],
  templateUrl: './marks-assessments.component.html',
  styleUrl: './marks-assessments.component.scss',
})
export class MarksAssessmentsComponent {
  private static readonly TAB_INDEX_BY_PARAM: Record<string, number> = {
    assessments: 0,
    'edit-requests': 1,
    overrides: 2,
  };
  private static readonly TAB_PARAM_BY_INDEX = ['assessments', 'edit-requests', 'overrides'];

  /** 0 = Assessments & Marks, 1 = Mark Edit Requests, 2 = Grade/Mark
   *  Overrides. Defaults to the first tab when there's no (or an
   *  unrecognized) ?tab= param. */
  activeTabIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTabIndex = requestedTab
      ? (MarksAssessmentsComponent.TAB_INDEX_BY_PARAM[requestedTab] ?? 0)
      : 0;
  }

  /** Bound to p-tabView's (activeIndexChange) rather than (onChange) —
   *  a plain number in/out is stable across PrimeNG versions, whereas
   *  the onChange event payload shape has moved between majors. */
  onTabIndexChange(index: number): void {
    this.activeTabIndex = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: MarksAssessmentsComponent.TAB_PARAM_BY_INDEX[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
