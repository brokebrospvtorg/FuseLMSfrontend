import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AcademicService } from '../../core/services/academic.service';
import { Subject, SubjectRequest, TimetableEntry } from '../../core/models/academic.model';
import { SubjectRequestStatus } from '../../core/models/enums';

@Component({
  selector: 'app-academic',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TableModule,
    TabViewModule,
    TagModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './academic.component.html',
  styleUrl: './academic.component.scss',
})
export class AcademicComponent implements OnInit {
  // --- Timetable tab ---
  timetable = signal<TimetableEntry[]>([]);
  timetableLoading = signal(true);
  timetableError = signal<string | null>(null);

  readonly gridDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  readonly gridDayLabels: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri',
  };

  /** Distinct period numbers present in the data, sorted — the grid's row count
   *  adapts to however many periods actually exist rather than a hardcoded 8. */
  gridPeriods = computed(() => {
    const periods = new Set(this.timetable().map((t) => t.period_number));
    return Array.from(periods).sort((a, b) => a - b);
  });

  /** slot lookup keyed "day|period" for O(1) cell rendering instead of
   *  filtering the array on every cell in the template. */
  private gridLookup = computed(() => {
    const map = new Map<string, TimetableEntry>();
    for (const entry of this.timetable()) {
      map.set(`${entry.day_of_week}|${entry.period_number}`, entry);
    }
    return map;
  });

  slotFor(day: string, period: number): TimetableEntry | null {
    return this.gridLookup().get(`${day}|${period}`) ?? null;
  }

  // --- Subject Requests tab ---
  availableSubjects = signal<Subject[]>([]);
  myRequests = signal<SubjectRequest[]>([]);
  requestsLoading = signal(true);
  requestsError = signal<string | null>(null);
  requestingSubjectId = signal<string | null>(null);

  // Requires knowing the current batch — in a real build this would come
  // from GET /api/academic/batches/current; hardcoded here as a placeholder
  // until that endpoint exists.
  private currentBatchId = 'CURRENT_BATCH_ID_PLACEHOLDER';

  constructor(private academicService: AcademicService) {}

  ngOnInit(): void {
    this.academicService.getMyTimetable().subscribe({
      next: (data) => {
        this.timetable.set(data);
        this.timetableLoading.set(false);
      },
      error: () => {
        this.timetableError.set('Could not load your timetable right now.');
        this.timetableLoading.set(false);
      },
    });

    this.loadSubjectRequestsData();
  }

  loadSubjectRequestsData(): void {
    this.requestsLoading.set(true);
    this.academicService.getAvailableSubjects().subscribe({
      next: (subjects) => {
        this.availableSubjects.set(subjects);
        this.academicService.getMySubjectRequests().subscribe({
          next: (requests) => {
            this.myRequests.set(requests);
            this.requestsLoading.set(false);
          },
          error: () => {
            this.requestsError.set('Could not load your subject requests right now.');
            this.requestsLoading.set(false);
          },
        });
      },
      error: () => {
        this.requestsError.set('Could not load available subjects right now.');
        this.requestsLoading.set(false);
      },
    });
  }

  requestSubject(subjectId: string): void {
    this.requestingSubjectId.set(subjectId);
    this.academicService
      .submitSubjectRequest({ subject_id: subjectId, batch_id: this.currentBatchId })
      .subscribe({
        next: () => {
          this.requestingSubjectId.set(null);
          this.loadSubjectRequestsData();
        },
        error: () => {
          this.requestingSubjectId.set(null);
        },
      });
  }

  severityFor(status: SubjectRequestStatus): 'success' | 'warn' | 'danger' {
    switch (status) {
      case SubjectRequestStatus.Approved:
        return 'success';
      case SubjectRequestStatus.Rejected:
        return 'danger';
      default:
        return 'warn';
    }
  }
}
