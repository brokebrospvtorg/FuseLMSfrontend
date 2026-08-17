import { Component, OnInit, effect, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ParentService } from '../../../core/services/parent.service';
import { ParentContextService } from '../../../core/services/parent-context.service';
import { ParentChild, ParentAttendanceSummary } from '../../../core/models/parent.model';

@Component({
  selector: 'app-parent-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, TableModule, TagModule, SelectModule, ProgressSpinnerModule, MessageModule],
  templateUrl: './parent-attendance.component.html',
  styleUrl: './parent-attendance.component.scss',
})
export class ParentAttendanceComponent implements OnInit {
  // Services inject karo pehle
  private parentService = inject(ParentService);
  private context = inject(ParentContextService);

  // Ab ye lines seamlessly work karengi
  children = this.context.children;
  childrenLoading = this.context.loading;
  childrenError = this.context.error;
  selectedChild = this.context.selectedChild;

  summary = signal<ParentAttendanceSummary | null>(null);
  summaryLoading = signal(false);
  summaryError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const child = this.context.selectedChild();
      if (child) {
        this.loadSummary(child.student_id);
      } else {
        this.summary.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.context.ensureLoaded();
  }

  onChildChange(child: ParentChild): void {
    this.context.selectChild(child.student_id);
  }

  private loadSummary(studentId: string): void {
    this.summaryLoading.set(true);
    this.summaryError.set(null);
    this.parentService.getChildAttendanceSummary(studentId).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
        this.summaryError.set('Could not load attendance for this child right now.');
      },
    });
  }

  /** Badge color per status, reused for both the breakdown table and the activity log. */
  severityFor(status: string): 'success' | 'danger' | 'warn' | 'info' {
    switch (status) {
      case 'present':
        return 'success';
      case 'absent':
        return 'danger';
      case 'late':
        return 'warn';
      default:
        return 'info'; // excused
    }
  }

  gaugeColorClass(pct: number | null): string {
    if (pct === null) return 'text-slate-400';
    if (pct >= 90) return 'text-green-600';
    if (pct >= 75) return 'text-amber-600';
    return 'text-red-600';
  }
}