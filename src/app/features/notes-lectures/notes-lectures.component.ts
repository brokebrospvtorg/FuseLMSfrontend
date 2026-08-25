import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';

import { CoordinatorClassroomRequestsComponent } from '../coordinator/classroom-requests/coordinator-classroom-requests.component';
import { CoordinatorYoutubeRequestsComponent } from '../coordinator/youtube-requests/coordinator-youtube-requests.component';

/**
 * "Notes & Lectures" module for the Admin and Coordinator portals.
 *
 * Previously two separate sidebar entries — "Classroom Requests"
 * (Teachers' proposed changes to an already-locked Google Classroom
 * link) and "Video Requests" (the same, for a locked YouTube video) —
 * are now sub-sections/tabs of one "Notes & Lectures" page, matching
 * the Teacher portal's existing "Lectures & Notes" naming.
 *
 * Design choice, consistent with FeeManagementComponent and
 * MarksAssessmentsComponent: a thin composition shell, not a merge of
 * both feature components' logic into one class.
 * CoordinatorClassroomRequestsComponent and
 * CoordinatorYoutubeRequestsComponent are already fully self-contained
 * standalone components — despite the "Coordinator" prefix, both are
 * already role-agnostic (the /admin and /coordinator route blocks load
 * the exact same two classes; see app.routes.ts) — and each keeps its
 * own signals/dialogs/service calls untouched here. p-tabView only
 * renders a panel's content once that tab has been opened, so neither
 * request queue is fetched until its tab is actually looked at.
 *
 * Tab switching logic: the active tab is mirrored to a `?tab=` query
 * param (`classroom` | `video`) rather than left as pure internal
 * p-tabView state, so a specific tab is deep-linkable (e.g. a
 * notification linking straight to a pending video-change request)
 * and survives a page refresh. `replaceUrl: true` keeps tab switches
 * out of browser history.
 */
@Component({
  selector: 'app-notes-lectures',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TabViewModule,
    CoordinatorClassroomRequestsComponent,
    CoordinatorYoutubeRequestsComponent,
  ],
  templateUrl: './notes-lectures.component.html',
  styleUrl: './notes-lectures.component.scss',
})
export class NotesLecturesComponent {
  private static readonly TAB_INDEX_BY_PARAM: Record<string, number> = {
    classroom: 0,
    video: 1,
  };
  private static readonly TAB_PARAM_BY_INDEX = ['classroom', 'video'];

  /** 0 = Classroom Requests, 1 = Video Requests. Defaults to the first
   *  tab when there's no (or an unrecognized) ?tab= param. */
  activeTabIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    this.activeTabIndex = requestedTab
      ? (NotesLecturesComponent.TAB_INDEX_BY_PARAM[requestedTab] ?? 0)
      : 0;
  }

  /** Bound to p-tabView's (activeIndexChange) rather than (onChange) —
   *  a plain number in/out is stable across PrimeNG versions, whereas
   *  the onChange event payload shape has moved between majors. */
  onTabIndexChange(index: number): void {
    this.activeTabIndex = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: NotesLecturesComponent.TAB_PARAM_BY_INDEX[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
