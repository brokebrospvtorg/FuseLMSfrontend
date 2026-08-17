import { Component, OnInit, effect, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

import { ParentService } from '../../../core/services/parent.service';
import { ParentContextService } from '../../../core/services/parent-context.service';
import { ChildSelectionDialogComponent } from '../child-selection-dialog/child-selection-dialog.component';
import { ParentChildOverview } from '../../../core/models/parent.model';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule, ChildSelectionDialogComponent],
  templateUrl: './parent-dashboard.component.html',
  styleUrl: './parent-dashboard.component.scss',
})
export class ParentDashboardComponent implements OnInit {
  // Inject services first so they are available for class property initializers
  private parentService = inject(ParentService);
  private context = inject(ParentContextService);

  // Delegated straight through to the shared context
  children = this.context.children;
  childrenLoading = this.context.loading;
  childrenError = this.context.error;
  selectedStudentId = this.context.selectedStudentId;
  selectedChild = this.context.selectedChild;

  switcherOpen = signal(false);

  overview = signal<ParentChildOverview | null>(null);
  overviewLoading = signal(false);

  attendanceColor = computed(() => {
    const pct = this.overview()?.overall_attendance_percentage;
    if (pct === null || pct === undefined) return 'text-slate-400';
    if (pct >= 90) return 'text-green-600';
    if (pct >= 75) return 'text-amber-600';
    return 'text-red-600';
  });

  constructor() {
    // Reacts to the shared selection changing — whether that happened from
    // this page's own switcher, or because the person picked a different
    // child on Attendance/Timetable and navigated back here.
    effect(() => {
      const child = this.context.selectedChild();
      if (child) {
        this.loadOverview(child.student_id);
      } else {
        this.overview.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.context.ensureLoaded();
  }

  toggleSwitcher(): void {
    this.switcherOpen.update((v) => !v);
  }

  selectChild(studentId: string): void {
    this.context.selectChild(studentId);
    this.switcherOpen.set(false);
  }

  private loadOverview(studentId: string): void {
    this.overviewLoading.set(true);
    this.overview.set(null);
    this.parentService.getChildOverview(studentId).subscribe({
      next: (data) => {
        this.overview.set(data);
        this.overviewLoading.set(false);
      },
      error: (err) => {
        this.overviewLoading.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not load this child\u2019s overview',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }

  /** Two-letter initials for the avatar circle, e.g. "Ayesha Malik" -> "AM". */
  initialsFor(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }
}