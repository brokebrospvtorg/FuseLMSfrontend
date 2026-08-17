import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import Swal from 'sweetalert2';

import { AuthService } from '../../../core/services/auth.service';

export type NavIconKey =
  | 'dashboard' | 'attendance' | 'timetable'
  | 'grades' | 'complaints' | 'fees' | 'materials' | 'lectures' | 'registry'
  | 'subject-requests';

export interface PortalNavItem {
  label: string;
  icon: NavIconKey;
  route: string;
  /** Optional group header rendered above this item — items sharing the
   *  same section are visually grouped, consecutive items with no section
   *  (or the same section as the previous item) render with no header.
   *  Added for the Admin sidebar (System Administration / Information
   *  Registry / Academics / Operations); every other portal's nav array
   *  simply doesn't set this and renders as a flat list, unchanged. */
  section?: string;
}

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './portal-layout.component.html',
})
export class PortalLayoutComponent {
  @Input() portalTitle = 'Student Portal';
  @Input() navItems: PortalNavItem[] = [];

  sidebarOpen = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  get userName(): string {
    return this.auth.currentUser()?.full_name ?? 'Welcome';
  }

  confirmLogout(): void {
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
