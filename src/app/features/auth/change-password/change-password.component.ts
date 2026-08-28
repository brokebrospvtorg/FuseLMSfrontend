import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from '../../../core/services/auth.service';
import { getRoleHome } from '../../../shared/utils/role-home';
import { evaluatePasswordStrength } from '../../../shared/utils/password-strength.util';

/**
 * FORCE PASSWORD CHANGE ON FIRST LOGIN — the forced destination.
 *
 * Reached only via mustChangePasswordGuard (any portal route, whenever
 * currentUser().must_change_password is true) or by navigating here
 * directly while that flag is set — changePasswordPageGuard bounces
 * everyone else back to their portal home. There is deliberately no
 * "Cancel" here (unlike the header's ChangePasswordDialogComponent,
 * which is the voluntary/informational version of this same form): the
 * only ways off this screen are a successful password change or logging
 * out, since reaching it means the account cannot proceed with its
 * current (temporary/admin-assigned) password.
 */
@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent {
  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showPasswords = signal(false);
  submitting = signal(false);

  // Live strength meter — recomputes whenever newPassword() changes.
  // Same 5 criteria the backend's validate_password_strength enforces
  // (app/schemas/common.py), so what the bar shows lines up with what
  // will actually be accepted on submit.
  passwordStrength = computed(() => evaluatePasswordStrength(this.newPassword()));

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  get userName(): string {
    return this.auth.currentUser()?.full_name ?? '';
  }

  onSubmit(): void {
    const current = this.currentPassword();
    const next = this.newPassword();
    const confirm = this.confirmPassword();

    if (!current) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Enter your current (temporary) password.', confirmButtonColor: '#101d3c' });
      return;
    }
    if (this.passwordStrength().score < 5) {
      Swal.fire({
        icon: 'warning',
        title: 'Password too weak',
        text: 'New password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character.',
        confirmButtonColor: '#101d3c',
      });
      return;
    }
    if (next !== confirm) {
      Swal.fire({ icon: 'warning', title: "Passwords don't match", text: 'New password and confirmation must match.', confirmButtonColor: '#101d3c' });
      return;
    }
    if (next === current) {
      Swal.fire({ icon: 'warning', title: 'Choose a different password', text: 'New password must be different from your current password.', confirmButtonColor: '#101d3c' });
      return;
    }

    this.submitting.set(true);
    this.auth
      .changePassword({ current_password: current, new_password: next, confirm_password: confirm })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          const role = this.auth.currentUser()?.role;
          Swal.fire({
            icon: 'success',
            title: 'Password changed',
            text: "You're all set — taking you to your dashboard.",
            confirmButtonColor: '#101d3c',
          }).then(() => this.router.navigate([getRoleHome(role)]));
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not change password',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
            confirmButtonColor: '#101d3c',
          });
        },
      });
  }

  logout(): void {
    Swal.fire({
      icon: 'question',
      title: 'Log out?',
      text: "You'll need to sign in again to access your portal.",
      showCancelButton: true,
      confirmButtonText: 'Log out',
      confirmButtonColor: '#101d3c',
      cancelButtonColor: '#94a3b8',
    }).then((result) => {
      if (result.isConfirmed) {
        this.auth.logout().subscribe(() => this.router.navigate(['/login']));
      }
    });
  }
}
