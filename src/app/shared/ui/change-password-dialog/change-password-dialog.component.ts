import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { AuthService } from '../../../core/services/auth.service';
import { evaluatePasswordStrength } from '../../utils/password-strength.util';

/**
 * Self-service "Change Password" — POST /api/auth/change-password. Mounted
 * once in PortalLayoutComponent (every role's shell), opened from the
 * header. Deliberately separate from the Admin/Coordinator Reset Password
 * dialog in admin-registry.component.html: this one requires knowing the
 * CURRENT password (that's the whole point — proving you ARE the account),
 * where the admin one doesn't and can't (an Admin resetting someone else's
 * password by definition doesn't know it).
 */
@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, InputTextModule, ButtonModule],
  templateUrl: './change-password-dialog.component.html',
})
export class ChangePasswordDialogComponent {
  open = signal(false);
  submitting = signal(false);

  currentPassword = signal('');
  newPassword = signal('');
  confirmPassword = signal('');

  // Live strength meter — same criteria as the backend's
  // validate_password_strength (app/schemas/common.py).
  passwordStrength = computed(() => evaluatePasswordStrength(this.newPassword()));

  constructor(private auth: AuthService) {}

  show(): void {
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.open.set(true);
  }

  submit(): void {
    const current = this.currentPassword();
    const next = this.newPassword();
    const confirm = this.confirmPassword();

    if (!current) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Enter your current password.' });
      return;
    }
    if (this.passwordStrength().score < 5) {
      Swal.fire({
        icon: 'warning',
        title: 'Password too weak',
        text: 'New password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character.',
      });
      return;
    }
    if (next !== confirm) {
      Swal.fire({ icon: 'warning', title: "Passwords don't match", text: 'New password and confirmation must match.' });
      return;
    }
    if (next === current) {
      Swal.fire({ icon: 'warning', title: 'Choose a different password', text: 'New password must be different from your current password.' });
      return;
    }

    this.submitting.set(true);
    this.auth
      .changePassword({ current_password: current, new_password: next, confirm_password: confirm })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.open.set(false);
          Swal.fire({ icon: 'success', title: 'Password changed', text: 'Your password has been updated.', confirmButtonColor: '#101d3c' });
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not change password',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
  }
}
