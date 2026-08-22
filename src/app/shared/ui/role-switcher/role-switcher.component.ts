import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { RoleSwitchService } from '../../../core/services/role-switch.service';
import { ActivePortalRole } from '../../../core/models/role-switch.model';

/**
 * "View as Coordinator" / "View as Teacher" toggle for the portal
 * header — sibling to ParentChildSwitcherComponent (same "extract the
 * shared bit out of the header markup" motivation), but a fixed
 * two-option toggle rather than a dropdown list, since there are only
 * ever exactly two portals a dual-role account can be in.
 *
 * Renders nothing (empty template, via the @if in the html) for every
 * account except a Coordinator who RoleSwitchService confirms also has
 * at least one active teaching assignment — a plain Coordinator, a
 * plain Teacher, and every other role never see this at all.
 *
 * Drop this into portal-layout.component.html's header, next to the
 * existing user-menu block — see patches/portal-layout.patch.md.
 */
@Component({
  selector: 'app-role-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-switcher.component.html',
})
export class RoleSwitcherComponent implements OnInit {
  readonly ActivePortalRole = ActivePortalRole;

  constructor(
    public roleSwitch: RoleSwitchService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.roleSwitch.ensureLoaded();
  }

  select(role: ActivePortalRole): void {
    if (role === this.roleSwitch.activePortalRole()) return;
    const targetPath = this.roleSwitch.switchTo(role);
    this.router.navigateByUrl(targetPath);
  }
}