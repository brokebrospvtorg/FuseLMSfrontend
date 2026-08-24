
  import { Component, Input, signal, ViewChild } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
  import Swal from 'sweetalert2';
  
  import { AuthService } from '../../../core/services/auth.service';
  import { ChangePasswordDialogComponent } from '../../ui/change-password-dialog/change-password-dialog.component';
  import { RoleSwitcherComponent } from '../../ui/role-switcher/role-switcher.component';
  
  export type NavIconKey =
    | 'dashboard' | 'attendance' | 'timetable'
    | 'grades' | 'complaints' | 'fees' | 'materials' | 'lectures' | 'registry'
    | 'subject-requests' | 'password-requests' | 'teachers';
  
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
    imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ChangePasswordDialogComponent, RoleSwitcherComponent],
    templateUrl: './portal-layout.component.html',
  })
  export class PortalLayoutComponent {
    @Input() portalTitle = 'Student Portal';
    @Input() navItems: PortalNavItem[] = [];
  
    @ViewChild(ChangePasswordDialogComponent) changePasswordDialog!: ChangePasswordDialogComponent;
  
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
  
    /** Password Management: true right after an Admin/Coordinator sets a
     *  temporary password for this account — drives the small "Change
     *  Password" nudge badge in the header, cleared once the person
     *  actually changes it via openChangePassword() below. */
    get mustChangePassword(): boolean {
      return this.auth.currentUser()?.must_change_password ?? false;
    }
  
    openChangePassword(): void {
      this.changePasswordDialog.show();
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