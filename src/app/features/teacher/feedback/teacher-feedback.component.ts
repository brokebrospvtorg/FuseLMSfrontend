import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { CommunicationService } from '../../../core/services/communication.service';
import { Complaint } from '../../../core/models/communication.model';
import { ComplaintStatus } from '../../../core/models/enums';

/**
 * Sub-Sprint 6.2 — Feedback & Complaint Screen.
 * Backend: POST/GET /api/complaints (app/routers/complaints.py) — same
 * table Students/Parents use, but a Teacher's submission has no student_id
 * (schema_update_2.sql made that column nullable for exactly this case).
 * Status list shows the Coordinator/Admin's resolution_message once they
 * act on it, plus a Pending/In Progress/Resolved badge — there's no
 * separate "Closed" status in the schema (ComplaintStatus is
 * open/in_progress/resolved), so "Resolved" is the closing state.
 */
@Component({
  selector: 'app-teacher-feedback',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, TagModule,
    ButtonModule, InputTextModule, TextareaModule, ProgressSpinnerModule, MessageModule,
  ],
  templateUrl: './teacher-feedback.component.html',
  styleUrl: './teacher-feedback.component.scss',
})
export class TeacherFeedbackComponent implements OnInit {
  complaints = signal<Complaint[]>([]);
  complaintsLoading = signal(true);
  complaintsError = signal<string | null>(null);

  newSubject = signal('');
  newDescription = signal('');
  submitting = signal(false);

  constructor(private communicationService: CommunicationService) {}

  ngOnInit(): void {
    this.loadComplaints();
  }

  loadComplaints(): void {
    this.complaintsLoading.set(true);
    this.communicationService.getMyComplaints().subscribe({
      next: (data) => {
        this.complaints.set(data);
        this.complaintsLoading.set(false);
      },
      error: () => {
        this.complaintsError.set('Could not load your feedback history right now.');
        this.complaintsLoading.set(false);
      },
    });
  }

  submitFeedback(): void {
    const description = this.newDescription().trim();
    if (!description) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Add a description before sending.' });
      return;
    }

    this.submitting.set(true);
    this.communicationService
      .submitComplaint({
        subject_of_complaint: this.newSubject().trim() || null,
        description,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.newSubject.set('');
          this.newDescription.set('');
          this.loadComplaints();
          Swal.fire({
            icon: 'success',
            title: 'Sent',
            text: 'Your Coordinator/Admin will review this.',
            timer: 1800,
            showConfirmButton: false,
          });
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({ icon: 'error', title: 'Could not send', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
  }

  severityFor(status: ComplaintStatus): 'warn' | 'info' | 'success' {
    switch (status) {
      case ComplaintStatus.Resolved:
        return 'success';
      case ComplaintStatus.InProgress:
        return 'info';
      default:
        return 'warn';
    }
  }

  labelFor(status: ComplaintStatus): string {
    switch (status) {
      case ComplaintStatus.Resolved:
        return 'Solved';
      case ComplaintStatus.InProgress:
        return 'In Progress';
      default:
        return 'Pending';
    }
  }
}
