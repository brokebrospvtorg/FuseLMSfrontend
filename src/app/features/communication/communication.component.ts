import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { CommunicationService } from '../../core/services/communication.service';
import { AuthService } from '../../core/services/auth.service';
import { Complaint, Notification } from '../../core/models/communication.model';
import { ComplaintStatus } from '../../core/models/enums';

@Component({
  selector: 'app-communication',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    TabViewModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './communication.component.html',
  styleUrl: './communication.component.scss',
})
export class CommunicationComponent implements OnInit {
  complaints = signal<Complaint[]>([]);
  complaintsLoading = signal(true);
  complaintsError = signal<string | null>(null);
  submitting = signal(false);

  newComplaintSubject = signal('');
  newComplaintDescription = signal('');

  notifications = signal<Notification[]>([]);
  notificationsLoading = signal(true);
  notificationsError = signal<string | null>(null);

  constructor(
    private communicationService: CommunicationService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadComplaints();
    this.loadNotifications();
  }

  loadComplaints(): void {
    this.communicationService.getMyComplaints().subscribe({
      next: (data) => {
        this.complaints.set(data);
        this.complaintsLoading.set(false);
      },
      error: () => {
        this.complaintsError.set('Could not load complaints right now.');
        this.complaintsLoading.set(false);
      },
    });
  }

  loadNotifications(): void {
    this.communicationService.getMyNotifications().subscribe({
      next: (data) => {
        this.notifications.set(data);
        this.notificationsLoading.set(false);
      },
      error: () => {
        this.notificationsError.set('Could not load notifications right now.');
        this.notificationsLoading.set(false);
      },
    });
  }

  submitComplaint(): void {
    if (!this.newComplaintDescription().trim()) return;
    const studentId = this.authService.currentUser()?.id;
    if (!studentId) return;

    this.submitting.set(true);
    this.communicationService
      .submitComplaint({
        student_id: studentId,
        subject_of_complaint: this.newComplaintSubject() || null,
        description: this.newComplaintDescription(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.newComplaintSubject.set('');
          this.newComplaintDescription.set('');
          this.loadComplaints();
        },
        error: () => {
          this.submitting.set(false);
        },
      });
  }

  markRead(id: string): void {
    this.communicationService.markNotificationRead(id).subscribe({
      next: () => this.loadNotifications(),
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
}
