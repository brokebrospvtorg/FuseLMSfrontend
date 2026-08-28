import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { getRoleHome } from '../../../shared/utils/role-home';

/**
 * Wildcard ('**') fallback — see app.routes.ts. Replaces the previous
 * `redirectTo: 'login'` silent bounce, which was misleading for a
 * logged-in user hitting a bad/stale link (it looked like they'd been
 * logged out, when the session was still fine).
 *
 * Deliberately has no guards on its own route — it must render for
 * literally any unmatched URL, logged in or not — so the "take me back"
 * destination is worked out here at render time instead, the same way
 * ChangePasswordComponent resolves its post-submit destination:
 *   - logged in  -> that role's dashboard (getRoleHome, single source of
 *     truth also used by LoginComponent/ChangePasswordComponent)
 *   - logged out -> /login (getRoleHome's own fallback when role is
 *     undefined, so this component doesn't need a separate branch for it)
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  goHome(): void {
    const role = this.auth.currentUser()?.role;
    this.router.navigate([getRoleHome(role)]);
  }
}
