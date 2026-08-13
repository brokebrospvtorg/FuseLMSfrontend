import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { RegistryService } from '../../../core/services/registry.service';
import { RegistryUser, AssignableRole } from '../../../core/models/registry.model';

const ROLE_FILTER_OPTIONS = [
  { label: 'All roles', value: null },
  { label: 'Admin', value: 'admin' },
  { label: 'Coordinator', value: 'coordinator' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
  { label: 'Parent', value: 'parent' },
];

// The 4 roles the API will ever accept for creation or reassignment —
// Admin is deliberately excluded (root-only, DB-precreated). Both dropdowns
// below (Add User, Edit Role) share this exact list so neither can ever
// offer an option the backend would reject.
const ASSIGNABLE_ROLE_OPTIONS: { label: string; value: AssignableRole }[] = [
  { label: 'Coordinator', value: 'coordinator' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' },
  { label: 'Parent', value: 'parent' },
];

@Component({
  selector: 'app-admin-registry',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputTextModule, DatePickerModule, TagModule, MessageModule, ProgressSpinnerModule,
  ],
  templateUrl: './admin-registry.component.html',
  styleUrl: './admin-registry.component.scss',
})
export class AdminRegistryComponent implements OnInit {
  roleFilterOptions = ROLE_FILTER_OPTIONS;
  assignableRoleOptions = ASSIGNABLE_ROLE_OPTIONS;

  users = signal<RegistryUser[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  roleFilter = signal<string | null>(null);
  searchTerm = signal('');

  filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.users();
    return this.users().filter(
      (u) => u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  });

  // --- Add User dialog ---
  addDialogOpen = signal(false);
  addSubmitting = signal(false);
  newFullName = signal('');
  newEmail = signal('');
  newRole = signal<AssignableRole | null>(null);
  // Role-conditional extras
  newRollNumber = signal('');
  newAdmissionDate = signal<Date | null>(null);
  newDesignation = signal('');
  newHireDate = signal<Date | null>(null);

  // --- Edit Role dialog ---
  editRoleDialogOpen = signal(false);
  editingUser = signal<RegistryUser | null>(null);
  editRoleValue = signal<AssignableRole | null>(null);
  editRoleSubmitting = signal(false);

  constructor(private registryService: RegistryService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  onRoleFilterChanged(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.registryService.getUsers(this.roleFilter() ?? undefined).subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load the Information Registry right now.');
        this.loading.set(false);
      },
    });
  }

  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' {
    if (status === 'active') return 'success';
    if (status === 'pending') return 'warn';
    if (status === 'suspended') return 'danger';
    return 'secondary';
  }

  roleLabel(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  // ---------------------------------------------------------------------
  // Add User
  // ---------------------------------------------------------------------
  openAddDialog(): void {
    this.newFullName.set('');
    this.newEmail.set('');
    this.newRole.set(null);
    this.newRollNumber.set('');
    this.newAdmissionDate.set(null);
    this.newDesignation.set('');
    this.newHireDate.set(null);
    this.addDialogOpen.set(true);
  }

  submitAddUser(): void {
    const fullName = this.newFullName().trim();
    const email = this.newEmail().trim();
    const role = this.newRole();

    if (!fullName || !email || !role) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Full name, email, and role are all required.' });
      return;
    }

    this.addSubmitting.set(true);
    this.registryService
      .createUser({
        full_name: fullName,
        email,
        role,
        roll_number: role === 'student' ? this.newRollNumber() || null : null,
        admission_date: role === 'student' && this.newAdmissionDate() ? this.toIsoDate(this.newAdmissionDate()!) : null,
        designation: role === 'teacher' ? this.newDesignation() || null : null,
        hire_date: role === 'teacher' && this.newHireDate() ? this.toIsoDate(this.newHireDate()!) : null,
      })
      .subscribe({
        next: () => {
          this.addSubmitting.set(false);
          this.addDialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: 'Account created',
            text: `${fullName} has been added as ${this.roleLabel(role)} — an activation email has been sent (console-logged for now).`,
            confirmButtonColor: '#101d3c',
          });
          this.loadUsers();
        },
        error: (err) => {
          this.addSubmitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not create account',
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
  }

  // ---------------------------------------------------------------------
  // Edit Role
  // ---------------------------------------------------------------------
  openEditRoleDialog(user: RegistryUser): void {
    if (user.role === 'admin') {
      Swal.fire({
        icon: 'info',
        title: "Can't reassign Admin",
        text: 'Admin accounts are managed directly in the database and cannot be reassigned here.',
      });
      return;
    }
    this.editingUser.set(user);
    this.editRoleValue.set(user.role as AssignableRole);
    this.editRoleDialogOpen.set(true);
  }

  submitEditRole(): void {
    const user = this.editingUser();
    const newRole = this.editRoleValue();
    if (!user || !newRole) return;

    if (newRole === user.role) {
      this.editRoleDialogOpen.set(false);
      return;
    }

    this.editRoleSubmitting.set(true);
    this.registryService.updateUser(user.id, { role: newRole }).subscribe({
      next: () => {
        this.editRoleSubmitting.set(false);
        this.editRoleDialogOpen.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Role updated',
          text: `${user.full_name} is now ${this.roleLabel(newRole)}.`,
          confirmButtonColor: '#101d3c',
        });
        this.loadUsers();
      },
      error: (err) => {
        this.editRoleSubmitting.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not change role',
          text: err?.error?.detail ?? 'Something went wrong. Please try again.',
        });
      },
    });
  }

  // ---------------------------------------------------------------------
  // Status (suspend / reactivate)
  // ---------------------------------------------------------------------
  toggleStatus(user: RegistryUser): void {
    if (user.role === 'admin') {
      Swal.fire({ icon: 'info', title: "Can't change Admin status", text: 'Admin accounts are managed directly in the database.' });
      return;
    }
    if (user.status === 'pending') {
      Swal.fire({ icon: 'info', title: 'Still pending activation', text: `${user.full_name} hasn't activated their account yet — nothing to suspend.` });
      return;
    }

    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'suspended' ? 'suspend' : 'reactivate';

    Swal.fire({
      icon: 'warning',
      title: `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${user.full_name}?`,
      showCancelButton: true,
      confirmButtonText: `Yes, ${verb}`,
      confirmButtonColor: '#101d3c',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.registryService.updateUser(user.id, { status: nextStatus }).subscribe({
        next: () => this.loadUsers(),
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: `Could not ${verb} account`,
            text: err?.error?.detail ?? 'Something went wrong. Please try again.',
          });
        },
      });
    });
  }

  private toIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
