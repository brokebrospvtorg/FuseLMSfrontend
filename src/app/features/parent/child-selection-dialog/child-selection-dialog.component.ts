import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ParentContextService } from '../../../core/services/parent-context.service';

const CONFIRMED_STORAGE_KEY = 'fuse.parent.childConfirmed';

/**
 * Forces a Parent with more than one linked child to explicitly pick one
 * before seeing their data, rather than silently defaulting to whichever
 * child ParentContextService.ensureLoaded() happens to pick first.
 *
 * Deliberately does NOT change ParentContextService's own default-pick
 * behavior (children[0] on load) — that stays as a safe fallback for
 * every other page. This dialog adds a separate "has the parent actually
 * confirmed a choice this session" flag on top of it, so:
 *   - 1 child linked: no dialog, nothing changes.
 *   - >1 children, first login this session: overlay blocks until picked.
 *   - >1 children, already confirmed earlier this session (or after a
 *     page refresh — flag is in sessionStorage, same lifetime as the
 *     selection itself): no dialog, straight to their last pick.
 *
 * Mounted in ParentDashboardComponent's template, since that's the actual
 * post-login landing page (see ROLE_HOME.parent in login.component.ts).
 * Not mounted at the portal-layout level — a deep link straight into e.g.
 * /parent/fees on a fresh session would skip it. Flagging that as a real
 * gap rather than silently declaring this airtight; revisit if parents
 * are observed landing on inner pages before ever hitting the dashboard.
 */
@Component({
  selector: 'app-child-selection-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './child-selection-dialog.component.html',
})
export class ChildSelectionDialogComponent {
  visible = signal(false);

  constructor(public context: ParentContextService) {
    this.context.ensureLoaded();

    effect(() => {
      if (this.context.loading()) return;
      const children = this.context.children();
      if (children.length <= 1) {
        // Nothing to choose between — mark confirmed so a later sibling
        // link-up mid-session doesn't unexpectedly pop the dialog.
        sessionStorage.setItem(CONFIRMED_STORAGE_KEY, '1');
        return;
      }
      const alreadyConfirmed = sessionStorage.getItem(CONFIRMED_STORAGE_KEY) === '1';
      this.visible.set(!alreadyConfirmed);
    });
  }

  pick(studentId: string): void {
    this.context.selectChild(studentId);
    sessionStorage.setItem(CONFIRMED_STORAGE_KEY, '1');
    this.visible.set(false);
  }

  initialsFor(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }
}
