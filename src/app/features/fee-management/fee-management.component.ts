import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';

import { AdminFeeStructuresComponent } from '../admin/fee-structures/admin-fee-structures.component';
import { AdminFeeReviewComponent } from '../admin-fees/admin-fee-review.component';

/**
 * Unified "Fee Management" page for the Admin and Coordinator portals.
 *
 * Both roles previously had two separate sidebar entries — "Fee
 * Structures" (/…/fee-structures) and "Fee Proofs" (/…/fees-review) —
 * pointing at two independently-routed components. Product asked for a
 * single page instead, with the same two capabilities now presented as
 * tabs: "Fee Structure" and "Fee Proofs".
 *
 * Design choice: this is a thin shell, not a merge of the two feature
 * components' logic into one class. AdminFeeStructuresComponent and
 * AdminFeeReviewComponent are already fully self-contained standalone
 * components (their own signals, dialogs, services) and are reused
 * as-is via composition — each mounts/unmounts with its tab, so neither
 * fetches data until its tab is actually opened, and there's no risk of
 * one tab's state leaking into the other's. Both components are already
 * role-agnostic (the backend scopes data to Admin/Coordinator via the
 * JWT, not a query param), so the same shell serves both portals — see
 * app.routes.ts, where /admin/fee-management and
 * /coordinator/fee-management both load this component.
 *
 * Tab switching logic: the active tab is mirrored to a `?tab=` query
 * param (`structure` | `proofs`) instead of being left as pure internal
 * p-tabView state. That makes a link like
 * `/admin/fee-management?tab=proofs` deep-linkable (e.g. from a
 * notification about a pending proof) and keeps the tab choice intact
 * across a page refresh. `replaceUrl: true` is used so tab switches
 * don't spam browser history with back-button stops.
 */
@Component({
  selector: 'app-fee-management',
  standalone: true,
  imports: [CommonModule, CardModule, TabViewModule, AdminFeeStructuresComponent, AdminFeeReviewComponent],
  templateUrl: './fee-management.component.html',
  styleUrl: './fee-management.component.scss',
})
export class FeeManagementComponent {
  private static readonly TAB_INDEX_BY_PARAM: Record<string, number> = {
    structure: 0,
    proofs: 1,
  };
  private static readonly TAB_PARAM_BY_INDEX = ['structure', 'proofs'];

  /** 0 = Fee Structure, 1 = Fee Proofs. Defaults to the Structure tab
   *  when there's no (or an unrecognized) ?tab= param. */
  activeTabIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTabIndex = requestedTab ? (FeeManagementComponent.TAB_INDEX_BY_PARAM[requestedTab] ?? 0) : 0;
  }

  /** Bound to p-tabView's (activeIndexChange) rather than (onChange) —
   *  a plain number in/out is stable across PrimeNG versions, whereas
   *  the onChange event payload shape has moved between majors. */
  onTabIndexChange(index: number): void {
    this.activeTabIndex = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: FeeManagementComponent.TAB_PARAM_BY_INDEX[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
