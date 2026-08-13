import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TimelineModule } from 'primeng/timeline';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import Swal from 'sweetalert2';

import { ParentService } from '../../../core/services/parent.service';
import { CommunicationService } from '../../../core/services/communication.service';
import { ParentChild } from '../../../core/models/parent.model';
import { Complaint } from '../../../core/models/communication.model';

const DESCRIPTION_MAX_LENGTH = 1000;

interface TimelineStep {
  label: string;
  reached: boolean;
  active: boolean;
}

@Component({
  selector: 'app-parent-complaints',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TagModule,
    SelectModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    TimelineModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './parent-complaints.component.html',
  styleUrl: './parent-complaints.component.scss',
})
export class ParentComplaintsComponent implements OnInit {
  readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;

  children = signal<ParentChild[]>([]);
  childrenLoading = signal(true);
  childrenError = signal<string | null>(null);

  // --- Launch Pad form ---
  formChild = signal<ParentChild | null>(null);
  title = signal('');
  description = signal('');
  submitting = signal(false);
  submitError = signal<string | null>(null);

  descriptionRemaining = computed(() => this.descriptionMaxLength - this.description().length);

  // --- Ticket history ---
  complaints = signal<Complaint[]>([]);
  complaintsLoading = signal(true);
  complaintsError = signal<string | null>(null);

  constructor(
    private parentService: ParentService,
    private communicationService: CommunicationService,
  ) {}

  ngOnInit(): void {
    this.parentService.getMyChildren().subscribe({
      next: (children) => {
        this.children.set(children);
        this.childrenLoading.set(false);
        if (children.length > 0) {
          this.formChild.set(children[0]);
        }
      },
      error: () => {
        this.childrenError.set('Could not load your linked children right now.');
        this.childrenLoading.set(false);
      },
    });

    this.loadComplaints();
  }

  private loadComplaints(): void {
    this.complaintsLoading.set(true);
    // Scoped server-side to complaints THIS parent submitted, across all
    // linked children — not filtered to the form's currently selected child.
    this.communicationService.getMyComplaints().subscribe({
      next: (data) => {
        this.complaints.set(data);
        this.complaintsLoading.set(false);
      },
      error: () => {
        this.complaintsError.set('Could not load your complaint history right now.');
        this.complaintsLoading.set(false);
      },
    });
  }

  onDescriptionChange(value: string): void {
    this.description.set(value.slice(0, this.descriptionMaxLength));
  }

  submit(): void {
    const child = this.formChild();
    const title = this.title().trim();
    const description = this.description().trim();

    if (!child || !description) {
      this.submitError.set('Choose a child and enter a description before submitting.');
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);
    this.communicationService
      .submitComplaint({
        student_id: child.student_id,
        subject_of_complaint: title || null,
        description,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.title.set('');
          this.description.set('');
          this.loadComplaints();
          Swal.fire({ icon: 'success', title: 'Complaint submitted', timer: 1600, showConfirmButton: false });
        },
        error: (err) => {
          this.submitting.set(false);
          this.submitError.set(err?.error?.detail ?? 'Could not submit this complaint. Try again.');
        },
      });
  }

  severityFor(status: string): 'success' | 'warn' | 'info' {
    if (status === 'resolved') return 'success';
    if (status === 'in_progress') return 'warn';
    return 'info';
  }

  /** Fixed 3-stage progression for the per-ticket timeline widget. */
  timelineFor(status: string): TimelineStep[] {
    const order = ['open', 'in_progress', 'resolved'];
    const currentIndex = order.indexOf(status);
    return [
      { label: 'Open', reached: currentIndex >= 0, active: status === 'open' },
      { label: 'In Progress', reached: currentIndex >= 1, active: status === 'in_progress' },
      { label: 'Resolved', reached: currentIndex >= 2, active: status === 'resolved' },
    ];
  }
}
