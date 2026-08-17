import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { YoutubeRequestsService } from '../../../core/services/youtube-requests.service';
import { YoutubeEditRequest } from '../../../core/models/content.model';
import { YoutubePlayerComponent } from '../../../shared/ui/youtube-player/youtube-player.component';
import { extractYoutubeVideoIdPreview } from '../../../shared/utils/youtube-preview';

type ReviewAction = 'approved' | 'rejected';

/**
 * Lectures Sub-Sprint 6 — Admin/Coordinator video-change Approval Dashboard.
 * Backend: GET/PATCH /api/youtube-requests (app/routers/content.py's
 * youtube_requests_router), already role-gated to admin/coordinator,
 * already returns lecture_title/subject_name/current_video_id/requester_name
 * pre-joined — same one-round-trip shape as the classroom queue.
 *
 * Task 6.1's actual point of difference from CoordinatorClassroomRequestsComponent:
 * a real embedded current-vs-proposed video comparison, not just a URL diff
 * — YoutubePlayerComponent renders `current_video_id` directly (already a
 * bare ID from the backend), and extractYoutubeVideoIdPreview() derives the
 * proposed one client-side from proposed_url purely for display (same
 * "preview only, never the source of truth" caveat as the Teacher's own
 * instant-preview in Sub-Sprint 5 — the backend re-parses and validates
 * proposed_url again on approve regardless).
 */
@Component({
  selector: 'app-coordinator-youtube-requests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, ButtonModule,
    DialogModule, TextareaModule, TagModule, ProgressSpinnerModule, MessageModule,
    YoutubePlayerComponent,
  ],
  templateUrl: './coordinator-youtube-requests.component.html',
  styleUrl: './coordinator-youtube-requests.component.scss',
})
export class CoordinatorYoutubeRequestsComponent implements OnInit {
  requests = signal<YoutubeEditRequest[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  // --- Review dialog ---
  dialogOpen = signal(false);
  dialogAction = signal<ReviewAction>('approved');
  actioningRequest = signal<YoutubeEditRequest | null>(null);
  reviewNote = signal('');
  submitting = signal(false);

  constructor(private youtubeRequestsService: YoutubeRequestsService) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.youtubeRequestsService.listRequests('pending').subscribe({
      next: (data) => {
        this.requests.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load pending requests right now.');
        this.loading.set(false);
      },
    });
  }

  /** Table-row thumbnail id — same derivation the dialog's bigger preview uses. */
  proposedVideoId(row: YoutubeEditRequest): string | null {
    return extractYoutubeVideoIdPreview(row.proposed_url);
  }

  openDialog(row: YoutubeEditRequest, action: ReviewAction): void {
    this.actioningRequest.set(row);
    this.dialogAction.set(action);
    this.reviewNote.set('');
    this.dialogOpen.set(true);
  }

  submitDecision(): void {
    const row = this.actioningRequest();
    if (!row) return;

    this.submitting.set(true);
    this.youtubeRequestsService
      .reviewRequest(row.id, {
        status: this.dialogAction(),
        review_note: this.reviewNote().trim() || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogOpen.set(false);
          Swal.fire({
            icon: 'success',
            title: this.dialogAction() === 'approved' ? 'Video change approved' : 'Video change rejected',
            text:
              this.dialogAction() === 'approved'
                ? `"${row.lecture_title}"'s video is now updated. ${row.requester_name} has been notified.`
                : `${row.requester_name} has been notified that this request was rejected.`,
            timer: 2400,
            showConfirmButton: false,
          });
          this.loadRequests();
        },
        error: (err) => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Could not submit review',
            text: err?.error?.detail ?? 'This request may have already been reviewed by someone else — refresh and check.',
          });
          this.loadRequests(); // same 409 "already reviewed" guard as the classroom queue
        },
      });
  }
}
