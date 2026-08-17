import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { TeacherContentService } from '../../../core/services/teacher-content.service';
import { Subject } from '../../../core/models/academic.model';
import { TeacherAssignment } from '../../../core/models/academics-staff.model';
import { Lecture } from '../../../core/models/content.model';
import { YoutubePlayerComponent } from '../../../shared/ui/youtube-player/youtube-player.component';
import { extractYoutubeVideoIdPreview } from '../../../shared/utils/youtube-preview';

/**
 * Lectures Sub-Sprint 3 (Google Classroom link) + Sub-Sprint 5 (YouTube
 * video), same UI shape reused for both workflows since they're the same
 * lock-once-then-request-to-edit pattern on two different fields:
 *
 *   no value yet    -> inline "Add ___" input + button (+ instant preview
 *                       for video, via YoutubePlayerComponent)
 *   value set/locked -> read-only value + "Request ___ Change" button
 *   pending request  -> "Edit request pending approval" badge instead of
 *                       the Request button (separate flags per workflow:
 *                       has_pending_edit_request for classroom,
 *                       has_pending_youtube_edit_request for video — a
 *                       lecture can have one, both, or neither pending
 *                       independently)
 *
 * Upload Lecture dialog no longer asks for a YouTube ID at all (Sub-Sprint
 * 2 moved video-setting to its own endpoint/lock — LectureCreate on the
 * backend doesn't accept youtube_video_id anymore either). A freshly
 * uploaded lecture starts with no video; the Teacher adds one via the
 * inline flow below straight after.
 */
@Component({
  selector: 'app-teacher-lectures-notes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, InputTextModule, TextareaModule, TagModule, ProgressSpinnerModule, MessageModule,
    YoutubePlayerComponent,
  ],
  templateUrl: './teacher-lectures-notes.component.html',
  styleUrl: './teacher-lectures-notes.component.scss',
})
export class TeacherLecturesNotesComponent implements OnInit {
  // --- Subject picker, scoped to this teacher's own assignments ---
  assignments = signal<TeacherAssignment[]>([]);
  subjects = signal<Subject[]>([]);
  pickerLoading = signal(true);
  selectedSubjectId = signal<string | null>(null);

  subjectOptions = computed(() => {
    const subjectsById = new Map(this.subjects().map((s) => [s.id, s]));
    const seen = new Set<string>();
    return this.assignments()
      .filter((a) => {
        if (seen.has(a.subject_id)) return false;
        seen.add(a.subject_id);
        return true;
      })
      .map((a) => subjectsById.get(a.subject_id))
      .filter((s): s is Subject => !!s)
      .map((s) => ({ label: s.name, value: s.id }));
  });

  // --- Lectures list ---
  lectures = signal<Lecture[]>([]);
  lecturesLoading = signal(false);
  lecturesError = signal<string | null>(null);

  // --- Inline "Add Classroom Link" input state, per lecture row ---
  addingLinkFor = signal<string | null>(null);
  newLinkValue = signal('');
  savingLink = signal(false);

  // --- Upload Lecture dialog (video no longer set here — Sub-Sprint 2) ---
  uploadDialogOpen = signal(false);
  newTitle = signal('');
  newDescription = signal('');
  uploading = signal(false);

  // --- Request Edit dialog (Task 3.2, classroom link) ---
  requestEditDialogOpen = signal(false);
  requestEditLecture = signal<Lecture | null>(null);
  proposedUrl = signal('');
  editReason = signal('');
  submittingRequest = signal(false);

  // --- Inline "Add YouTube Video" input state, per lecture row (Sub-Sprint 5, Task 5.1) ---
  addingVideoFor = signal<string | null>(null);
  newVideoUrl = signal('');
  newVideoPreviewId = computed(() => extractYoutubeVideoIdPreview(this.newVideoUrl()));
  savingVideo = signal(false);

  // --- Request Video Change dialog (Sub-Sprint 5, Task 5.2) ---
  requestVideoEditDialogOpen = signal(false);
  requestVideoEditLecture = signal<Lecture | null>(null);
  proposedVideoUrl = signal('');
  proposedVideoPreviewId = computed(() => extractYoutubeVideoIdPreview(this.proposedVideoUrl()));
  videoEditReason = signal('');
  submittingVideoRequest = signal(false);

  constructor(
    private academicsStaffService: AcademicsStaffService,
    private teacherContentService: TeacherContentService,
  ) {}

  ngOnInit(): void {
    this.academicsStaffService.getMyTeacherAssignments().subscribe({
      next: (assignments) => {
        this.assignments.set(assignments);
        this.academicsStaffService.getSubjects().subscribe({
          next: (subjects) => {
            this.subjects.set(subjects);
            this.pickerLoading.set(false);
          },
          error: () => this.pickerLoading.set(false),
        });
      },
      error: () => this.pickerLoading.set(false),
    });
  }

  onSubjectChange(subjectId: string | null): void {
    this.selectedSubjectId.set(subjectId);
    if (subjectId) this.loadLectures(subjectId);
  }

  private loadLectures(subjectId: string): void {
    this.lecturesLoading.set(true);
    this.lecturesError.set(null);
    this.teacherContentService.getLecturesForSubject(subjectId, true).subscribe({
      next: (data) => {
        this.lectures.set(data);
        this.lecturesLoading.set(false);
      },
      error: () => {
        this.lecturesError.set('Could not load your lectures right now.');
        this.lecturesLoading.set(false);
      },
    });
  }

  // --- Upload Lecture ---
  openUploadDialog(): void {
    this.newTitle.set('');
    this.newDescription.set('');
    this.uploadDialogOpen.set(true);
  }

  submitUpload(): void {
    const subjectId = this.selectedSubjectId();
    const title = this.newTitle().trim();
    if (!subjectId || !title) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'A title is required.' });
      return;
    }
    this.uploading.set(true);
    this.teacherContentService
      .createLecture({ subject_id: subjectId, title, description: this.newDescription() || null })
      .subscribe({
        next: () => {
          this.uploading.set(false);
          this.uploadDialogOpen.set(false);
          this.loadLectures(subjectId);
        },
        error: (err) => {
          this.uploading.set(false);
          Swal.fire({ icon: 'error', title: 'Could not upload', text: err?.error?.detail ?? 'Please try again.' });
        },
      });
  }

  // --- Task 3.1: Add Classroom Link (initial set, one-time) ---
  startAddingLink(lecture: Lecture): void {
    this.addingLinkFor.set(lecture.id);
    this.newLinkValue.set('');
  }

  cancelAddingLink(): void {
    this.addingLinkFor.set(null);
    this.newLinkValue.set('');
  }

  saveLink(lecture: Lecture): void {
    const url = this.newLinkValue().trim();
    // Task 5.2's http(s):// enforcement is also done server-side (Pydantic
    // HttpUrl) — this is just a fast client-side check so a Teacher isn't
    // round-tripping to the server to find out they forgot the scheme.
    if (!/^https?:\/\/.+/i.test(url)) {
      Swal.fire({ icon: 'warning', title: 'Invalid link', text: 'The link must start with http:// or https://.' });
      return;
    }
    this.savingLink.set(true);
    this.teacherContentService.setClassroomUrl(lecture.id, url).subscribe({
      next: () => {
        this.savingLink.set(false);
        this.addingLinkFor.set(null);
        const subjectId = this.selectedSubjectId();
        if (subjectId) this.loadLectures(subjectId);
      },
      error: (err) => {
        this.savingLink.set(false);
        Swal.fire({ icon: 'error', title: 'Could not save link', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  // --- Task 3.2: Request Edit modal ---
  openRequestEditDialog(lecture: Lecture): void {
    this.requestEditLecture.set(lecture);
    this.proposedUrl.set('');
    this.editReason.set('');
    this.requestEditDialogOpen.set(true);
  }

  submitRequestEdit(): void {
    const lecture = this.requestEditLecture();
    const url = this.proposedUrl().trim();
    const reason = this.editReason().trim();
    if (!lecture) return;
    if (!/^https?:\/\/.+/i.test(url)) {
      Swal.fire({ icon: 'warning', title: 'Invalid link', text: 'The proposed link must start with http:// or https://.' });
      return;
    }
    if (!reason) {
      Swal.fire({ icon: 'warning', title: 'Reason required', text: 'Let the Coordinator know why the link needs to change.' });
      return;
    }

    this.submittingRequest.set(true);
    this.teacherContentService.requestClassroomEdit(lecture.id, url, reason).subscribe({
      next: () => {
        this.submittingRequest.set(false);
        this.requestEditDialogOpen.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Request submitted',
          text: 'A Coordinator or Admin will review it shortly.',
          confirmButtonColor: '#101d3c',
        });
        const subjectId = this.selectedSubjectId();
        if (subjectId) this.loadLectures(subjectId);
      },
      error: (err) => {
        this.submittingRequest.set(false);
        Swal.fire({ icon: 'error', title: 'Could not submit request', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  // --- Sub-Sprint 5, Task 5.1: Add YouTube Video (initial set, one-time) ---
  startAddingVideo(lecture: Lecture): void {
    this.addingVideoFor.set(lecture.id);
    this.newVideoUrl.set('');
  }

  cancelAddingVideo(): void {
    this.addingVideoFor.set(null);
    this.newVideoUrl.set('');
  }

  saveVideo(lecture: Lecture): void {
    const url = this.newVideoUrl().trim();
    if (!url) {
      Swal.fire({ icon: 'warning', title: 'Missing URL', text: 'Paste a YouTube link or video ID first.' });
      return;
    }
    // The instant preview already tells the Teacher if this looks
    // unrecognizable before they even click Save (see the template) — this
    // is a last-chance guard, not the first one; the authoritative check
    // is still server-side (parse_youtube_video_id), which is what
    // actually decides whether the save succeeds.
    if (!this.newVideoPreviewId()) {
      Swal.fire({
        icon: 'warning',
        title: 'Video not recognized',
        text: 'Paste a full YouTube link (youtube.com/watch?v=..., youtu.be/..., /embed/..., /shorts/...) or an 11-character video ID.',
      });
      return;
    }
    this.savingVideo.set(true);
    this.teacherContentService.setYoutubeVideo(lecture.id, url).subscribe({
      next: () => {
        this.savingVideo.set(false);
        this.addingVideoFor.set(null);
        const subjectId = this.selectedSubjectId();
        if (subjectId) this.loadLectures(subjectId);
      },
      error: (err) => {
        this.savingVideo.set(false);
        Swal.fire({ icon: 'error', title: 'Could not save video', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  // --- Sub-Sprint 5, Task 5.2: Request Video Change modal ---
  openRequestVideoEditDialog(lecture: Lecture): void {
    this.requestVideoEditLecture.set(lecture);
    this.proposedVideoUrl.set('');
    this.videoEditReason.set('');
    this.requestVideoEditDialogOpen.set(true);
  }

  submitRequestVideoEdit(): void {
    const lecture = this.requestVideoEditLecture();
    const url = this.proposedVideoUrl().trim();
    const reason = this.videoEditReason().trim();
    if (!lecture) return;
    if (!this.proposedVideoPreviewId()) {
      Swal.fire({
        icon: 'warning',
        title: 'Video not recognized',
        text: 'Paste a full YouTube link (youtube.com/watch?v=..., youtu.be/..., /embed/..., /shorts/...) or an 11-character video ID.',
      });
      return;
    }
    if (!reason) {
      Swal.fire({ icon: 'warning', title: 'Reason required', text: 'Let the Coordinator know why the video needs to change.' });
      return;
    }

    this.submittingVideoRequest.set(true);
    this.teacherContentService.requestYoutubeEdit(lecture.id, url, reason).subscribe({
      next: () => {
        this.submittingVideoRequest.set(false);
        this.requestVideoEditDialogOpen.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Request submitted',
          text: 'A Coordinator or Admin will review it shortly.',
          confirmButtonColor: '#101d3c',
        });
        const subjectId = this.selectedSubjectId();
        if (subjectId) this.loadLectures(subjectId);
      },
      error: (err) => {
        this.submittingVideoRequest.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Could not submit request',
          text: err?.error?.detail ?? 'Please try again.',
        });
      },
    });
  }
}
