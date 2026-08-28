import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from '../../../core/services/auth.service';
import { getRoleHome } from '../../../shared/utils/role-home';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // FormsModule removed — no more [(ngModel)]
  templateUrl: './login.component.html',
})
export class LoginComponent {
  // --- Reactive Form ---------------------------------------------------
  // Strongly typed FormGroup (Angular 14+ "Typed Forms"): each FormControl
  // declares its value type, so `loginForm.value.identifier` is `string`,
  // not `any`. `nonNullable: true` means .reset() puts it back to '' 
  // instead of null, which keeps the type as `string` (not `string | null`)
  // and matches what the old signal-based version always assumed.
  loginForm = new FormGroup({
    identifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  // UI-only state (not form data) — these stay as signals exactly as before.
  showPassword = signal(false);
  loading = signal(false);

  constructor(
    private router: Router,
    private auth: AuthService,
  ) {}

  // Convenience getters so the template can read `identifier.invalid` /
  // `identifier.touched` etc. without repeating `loginForm.controls...`.
  get identifier() {
    return this.loginForm.controls.identifier;
  }
  get password() {
    return this.loginForm.controls.password;
  }

  onSubmit(): void {
    // markAllAsTouched() flips every control's `touched` state to true so
    // validation messages appear immediately on a submit attempt, even for
    // fields the user never focused/blurred. Without this, an untouched
    // invalid control stays silent until the user happens to interact
    // with it — which reads as "the button did nothing".
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    // .value only contains identifier/password by construction, and both
    // are guaranteed `string` (never null) because of `nonNullable: true`
    // above — no more manual `.trim()` guarding against undefined.
    const { identifier, password } = this.loginForm.getRawValue();

    this.auth
      .login({
        email: identifier.trim(),
        password,
      })
      .subscribe({
        next: (user) => {
          this.loading.set(false);

          // FORCE PASSWORD CHANGE ON FIRST LOGIN: a temporary/admin-reset
          // password sends the user straight to the forced-change screen,
          // before they ever see a dashboard — this is the front door of
          // that flow; mustChangePasswordGuard covers every other one
          // (deep links, back button, a stale tab reused after a reset).
          if (user.must_change_password) {
            this.router.navigate(['/change-password']);
            return;
          }

          const home = getRoleHome(user.role);
          if (home !== '/login') {
            this.router.navigate([home]);
            return;
          }

          Swal.fire({
            icon: 'info',
            title: `Welcome, ${user.full_name}`,
            text: `You're logged in as ${user.role}. That portal isn't built yet — check back soon.`,
            confirmButtonColor: '#101d3c',
          });
        },
        error: (err) => {
          this.loading.set(false);
          this.showError(err);
        },
      });
  }

  private showError(err: any): void {
    // status 0 means the request never reached the server at all
    // (backend down, CORS block, no network) — worth a distinct message.
    if (err.status === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Network error',
        text: "Couldn't reach the server. Check your connection and try again.",
        confirmButtonColor: '#101d3c',
      });
      return;
    }

    const detail: string = err?.error?.detail ?? 'Something went wrong. Please try again.';

    // A failed login (bad credentials) is the moment this is most useful —
    // offer the admin-approval reset path right alongside the error
    // instead of making them separately notice the footer link.
    if (err.status === 401) {
      Swal.fire({
        icon: 'error',
        title: 'Login failed',
        text: detail,
        confirmButtonText: 'Try Again',
        confirmButtonColor: '#101d3c',
        showDenyButton: true,
        denyButtonText: 'Request Password Reset from Admin',
        denyButtonColor: '#475569',
      }).then((result) => {
        if (result.isDenied) this.requestPasswordResetFromAdmin();
      });
      return;
    }

    Swal.fire({
      icon: err.status === 402 ? 'warning' : 'error',
      title: err.status === 402 ? 'Access restricted' : 'Login failed',
      text: detail,
      confirmButtonColor: '#101d3c',
    });
  }

  /** 'Request Password Reset from Admin' — offered both from the footer
   *  link and from a failed-login prompt. No session/token needed; just
   *  files a password_reset_requests row an Admin reviews from Operations
   *  > Password Requests. Uses a Swal input prompt rather than a full
   *  dialog component since it's a single free-text field. */
  requestPasswordResetFromAdmin(): void {
    Swal.fire({
      title: 'Request Password Reset from Admin',
      html: "Enter your email, roll number, or employee code. An Admin will reset your password — you'll log in with the temporary password they provide and be asked to set a new one.",
      input: 'text',
      inputPlaceholder: 'Email, roll number, or employee code',
      showCancelButton: true,
      confirmButtonText: 'Send Request',
      confirmButtonColor: '#101d3c',
      inputValidator: (value) =>
        !value?.trim() ? 'Please enter your email, roll number, or employee code.' : undefined,
    }).then((result) => {
      if (!result.isConfirmed || !result.value) return;

      this.auth.requestPasswordResetApproval({ identifier: result.value.trim() }).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Request Sent',
            text: 'Reset request sent to Admin successfully.',
            confirmButtonColor: '#101d3c',
          });
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Could not send request',
            text: 'Something went wrong sending your request. Please try again shortly.',
            confirmButtonColor: '#101d3c',
          });
        },
      });
    });
  }
}
