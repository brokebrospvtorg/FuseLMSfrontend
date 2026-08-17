import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ParentContextService } from '../../../core/services/parent-context.service';

/**
 * Extracted from the switcher markup that was duplicated inline in
 * ParentDashboardComponent (and would otherwise have been duplicated
 * again in the new Subject Requests page). Every parent page should use
 * this instead of its own local switcherOpen/selectChild logic — it reads
 * and writes through the shared ParentContextService, so the selection
 * (and its sessionStorage persistence) stays in sync everywhere.
 *
 * NOTE: existing pages (Dashboard, Attendance, Timetable, Fees, Report
 * Card) still have their own inline copy of this markup — this component
 * doesn't retroactively replace them. Worth doing as a follow-up cleanup,
 * not done here to avoid touching pages outside this sub-sprint's scope.
 */
@Component({
  selector: 'app-parent-child-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parent-child-switcher.component.html',
})
export class ParentChildSwitcherComponent {
  switcherOpen = signal(false);

  constructor(public context: ParentContextService) {
    this.context.ensureLoaded();
  }

  toggleSwitcher(): void {
    this.switcherOpen.update((v) => !v);
  }

  pick(studentId: string): void {
    this.context.selectChild(studentId);
    this.switcherOpen.set(false);
  }

  initialsFor(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }
}
