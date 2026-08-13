import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from '../../../core/services/auth.service';

// Only the student portal exists so far — everything else routes here
// once login succeeds, so Admin/Coordinator/Teacher/Parent accounts still
// get a clean confirmation instead of a dead 404.
const ROLE_HOME: Partial<Record<string, string>> = {
  student: '/student/dashboard',
  teacher: '/teacher/marks',
  coordinator: '/coordinator/grades',
  admin: '/admin/registry',
  parent: '/parent/dashboard',
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  identifier = signal('');
  password = signal('');
  showPassword = signal(false);
  loading = signal(false);

  constructor(
    private router: Router,
    private auth: AuthService,
  ) {}

  onSubmit(): void {
    if (!this.identifier().trim() || !this.password().trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing details',
        text: 'Please enter both your email and password.',
        confirmButtonColor: '#101d3c',
      });
      return;
    }

    this.loading.set(true);

    this.auth
      .login({
        email: this.identifier().trim(),
        password: this.password(),
      })
      .subscribe({
        next: (user) => {
          this.loading.set(false);
          const home = ROLE_HOME[user.role];

          if (home) {
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

    Swal.fire({
      icon: err.status === 402 ? 'warning' : 'error',
      title: err.status === 402 ? 'Access restricted' : 'Login failed',
      text: detail,
      confirmButtonColor: '#101d3c',
    });
  }
}
