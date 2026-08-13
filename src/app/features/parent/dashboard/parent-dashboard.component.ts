import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

import { ParentService } from '../../../core/services/parent.service';
import { ParentChild, ParentChildOverview } from '../../../core/models/parent.model';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parent-dashboard.component.html',
  styleUrl: './parent-dashboard.component.scss',
})
export class ParentDashboardComponent implements OnInit {
  children = signal<ParentChild[]>([]);
  childrenLoading = signal(true);
  childrenError = signal<string | null>(null);

  selectedStudentId = signal<string | null>(null);
  switcherOpen = signal(false);

  overview = signal<ParentChildOverview | null>(null);
  overviewLoading = signal(false);

  selectedChild = computed<ParentChild | null>(
    () => this.children().find((c) => c.student_id === this.selectedStudentId()) ?? null,
  );

  attendanceColor = computed(() => {
    const pct = this.overview()?.overall_attendance_percentage;
    if (pct === null || pct === undefined) return 'text-slate-400';
    if (pct >= 90) return 'text-green-600';
    if (pct >= 75) return 'text-amber-600';
    return 'text-red-600';
  });

  constructor(private parentService: ParentService) {}

  ngOnInit(): void {
    this.parentService.getMyChildren().subscribe({
      next: (children) => {
        this.children.set(children);
        this.childrenLoading.set(false);
        if (children.length > 0) {
          this.selectChild(children[0].student_id);
        }
      },
      error: () => {
        this.childrenError.set('Could not load your linked children right now.');
        this.childrenLoading.set(false);
      },
    });
  }

  toggleSwitcher(): void {
    this.switcherOpen.update((v) => !v);
  }

  selectChild(studentId: string): void {
    this.selectedStudentId.set(studentId);
    this.switcherOpen.set(false);
    this.loadOverview(studentId);
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
