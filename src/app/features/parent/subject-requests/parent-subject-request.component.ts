import { Component, OnInit, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { ParentService } from '../../../core/services/parent.service';
import { ParentContextService } from '../../../core/services/parent-context.service';
import { ParentChildSwitcherComponent } from '../../../shared/ui/parent-child-switcher/parent-child-switcher.component';
import { Subject } from '../../../core/models/academic.model';
import { ParentSubjectRequest } from '../../../core/models/parent.model';

/**
 * Sub-Sprint 2 — Parent Subject Requests.
 *
 * Backend: GET/POST /api/parent/child/{id}/subject-requests,
 * GET /api/parent/child/{id}/available-subjects (all new — app/routers/parent.py).
 *
 * Two real gaps found and fixed to make this possible, not just "used
 * as-is": POST /api/academic/subject-requests is hard-locked to
 * require_roles("student") with student_id always = current_user.id, and
 * GET /api/academic/subject-requests 403s any role that isn't
 * student/admin/coordinator — a Parent could not have submitted or listed
 * requests through those endpoints no matter how this component called
 * them. Built as separate parent-scoped endpoints instead (see parent.py
 * for why), each going through the same _verify_linked_child check as
 * every other parent endpoint.
 *
 * `reason` on the create form is NOT a real column — subject_requests has
 * no such field. It's folded into the notification sent to the
 * Admin/Coordinator reviewers server-side. See ParentSubjectRequestCreate
 * in schemas/parent.py.
 */
@Component({
  selector: 'app-parent-subject-request',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule,
    ButtonModule, TextareaModule, TagModule, ProgressSpinnerModule,
    ParentChildSwitcherComponent,
  ],
  templateUrl: './parent-subject-request.component.html',
  styleUrl: './parent-subject-request.component.scss',
})
export class ParentSubjectRequestComponent implements OnInit {
  availableSubjects = signal<Subject[]>([]);
  currentBatchId = signal<string | null>(null);
  currentBatchName = signal<string | null>(null);
  availableLoading = signal(false);

  requests = signal<ParentSubjectRequest[]>([]);
  requestsLoading = signal(false);

  subjectOptions = computed(() =>
    this.availableSubjects().map((s) => ({ label: s.name, value: s.id })),
  );

  selectedSubjectId = signal<string | null>(null);
  reason = signal('');
  submitting = signal(false);

  private lastLoadedFor: string | null = null;

  constructor(public context: ParentContextService, private parentService: ParentService) {
    // Re-fetches everything whenever the shared selected child changes —
    // including a switch made from a different page before navigating here.
    effect(() => {
      const studentId = this.context.selectedStudentId();
      if (studentId && studentId !== this.lastLoadedFor) {
        this.lastLoadedFor = studentId;
        this.loadAvailableSubjects(studentId);
        this.loadRequests(studentId);
      }
    });
  }

  ngOnInit(): void {
    this.context.ensureLoaded();
  }

  private loadAvailableSubjects(studentId: string): void {
    this.availableLoading.set(true);
    this.selectedSubjectId.set(null);
    this.parentService.getAvailableSubjectsForChild(studentId).subscribe({
      next: (data) => {
        this.availableSubjects.set(data.subjects);
        this.currentBatchId.set(data.batch_id);
        this.currentBatchName.set(data.batch_name);
        this.availableLoading.set(false);
      },
      error: () => {
        this.availableLoading.set(false);
        Swal.fire({ icon: 'error', title: 'Could not load available subjects', text: 'Please try again.' });
      },
    });
  }

  private loadRequests(studentId: string): void {
    this.requestsLoading.set(true);
    this.parentService.getSubjectRequestsForChild(studentId).subscribe({
      next: (data) => {
        this.requests.set(data);
        this.requestsLoading.set(false);
      },
      error: () => this.requestsLoading.set(false),
    });
  }

  submitRequest(): void {
    const studentId = this.context.selectedStudentId();
    const subjectId = this.selectedSubjectId();
    const batchId = this.currentBatchId();
    if (!studentId || !subjectId || !batchId) return;

    this.submitting.set(true);
    this.parentService
      .createSubjectRequestForChild(studentId, {
        subject_id: subjectId,
        batch_id: batchId,
        reason: this.reason().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.selectedSubjectId.set(null);
          this.reason.set('');
          Swal.fire({
            icon: 'success',
            title: 'Request submitted',
            text: 'The Coordinator/Admin has been notified.',
            timer: 2200,
            showConfirmButton: false,
          });
          this.loadAvailableSubjects(studentId); // requested subject drops out of the picker
          this.loadRequests(studentId);
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not submit request',
            text: err?.error?.detail ?? 'Please try again.',
          });
        },
      });
  }
}
