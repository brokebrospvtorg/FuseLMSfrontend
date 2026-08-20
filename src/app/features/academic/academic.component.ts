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
import { BatchSubject, SubjectRequest, TimetableEntry } from '../../core/models/academic.model';
import { SubjectRequestStatus } from '../../core/models/enums';

/**
 * Sprint 3 — Student "Timetable & Subject Requests" screen.
 *
 * This is the actual screen behind the "Could not load available subjects
 * right now" bug — there's no separate `student-subject-request.component`
 * in this codebase; the Subject Requests tab has always lived here
 * alongside Timetable. Fixed in place rather than forking a duplicate
 * component.
 *
 * Root cause: AcademicService.getAvailableSubjects() /
 * getMySubjectRequests() pointed at GET /academic/subjects/available and
 * GET /academic/subject-requests/me — neither route exists on the
 * backend (404 -> the error you were seeing). There was also a hardcoded
 * `CURRENT_BATCH_ID_PLACEHOLDER` standing in for the student's batch, so
 * even a working available-subjects call would have submitted requests
 * against a batch that doesn't exist.
 *
 * Fixed to:
 *  - Resolve the real current batch via AcademicService.getCurrentBatch()
 *    (GET /academic/batches, is_current = true) — the same "current
 *    batch" concept the backend itself uses for this student-batch
 *    relationship (dashboard_summary, parent.py's available-subjects).
 *  - Load ONLY explicitly-offered subjects via
 *    GET /academic/batches/{batch_id}/offered-subjects — never the raw
 *    subject catalog — so nothing appears here Admin hasn't turned on
 *    for this batch.
 *  - Hide subjects the student already has a requested/approved request
 *    for, client-side, against GET /academic/subject-requests (which
 *    already scopes to the caller when role = student).
 */
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
  /** Everything explicitly offered for the resolved batch — the raw fetch
   *  result before the "already requested" client-side filter below. */
  private offeredSubjects = signal<BatchSubject[]>([]);
  myRequests = signal<SubjectRequest[]>([]);
  requestsLoading = signal(true);
  requestsError = signal<string | null>(null);
  requestingSubjectId = signal<string | null>(null);

  /** No offered-subjects response for the resolved batch distinguishes
   *  "nothing offered yet" from "couldn't resolve a current batch at
   *  all" — the empty-state copy in the template differs for each. */
  batchId = signal<string | null>(null);
  batchName = signal<string | null>(null);
  noBatchResolved = signal(false);

  /** Subjects still requestable: offered for the batch, minus anything
   *  the student already has a pending or approved request for. Requested
   *  subjects should disappear from the picker immediately, not just
   *  after a refetch — an approved/requested one re-showing here would
   *  let a student fire off a duplicate request. */
  availableSubjects = computed(() => {
    const alreadyActioned = new Set(
      this.myRequests()
        .filter((r) => r.status === SubjectRequestStatus.Requested || r.status === SubjectRequestStatus.Approved)
        .map((r) => r.subject_id),
    );
    return this.offeredSubjects().filter((s) => !alreadyActioned.has(s.subject_id));
  });

  /** subject_id -> subject_name, used to display "My Requests" rows
   *  without a subject_name field on SubjectRequestOut server-side. */
  private subjectNameLookup = computed(() => {
    const map = new Map<string, string>();
    for (const s of this.offeredSubjects()) map.set(s.subject_id, s.subject_name);
    return map;
  });

  subjectNameFor(request: SubjectRequest): string {
    return request.subject_name ?? this.subjectNameLookup().get(request.subject_id) ?? request.subject_id;
  }

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
    this.requestsError.set(null);

    this.academicService.getCurrentBatch().subscribe({
      next: (batch) => {
        if (!batch) {
          this.noBatchResolved.set(true);
          this.offeredSubjects.set([]);
          this.batchId.set(null);
          this.batchName.set(null);
          this.requestsLoading.set(false);
          return;
        }

        this.noBatchResolved.set(false);
        this.batchId.set(batch.id);
        this.batchName.set(batch.name);

        this.academicService.getOfferedSubjects(batch.id).subscribe({
          next: (subjects) => {
            this.offeredSubjects.set(subjects);
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
      },
      error: () => {
        this.requestsError.set('Could not load available subjects right now.');
        this.requestsLoading.set(false);
      },
    });
  }

  requestSubject(subjectId: string): void {
    const batchId = this.batchId();
    if (!batchId) return;

    this.requestingSubjectId.set(subjectId);
    this.academicService
      .submitSubjectRequest({ subject_id: subjectId, batch_id: batchId })
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
