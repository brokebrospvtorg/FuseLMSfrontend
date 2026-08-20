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
import { Lecture, SubjectClassroomLink } from '../../../core/models/content.model';
import { YoutubePlayerComponent } from '../../../shared/ui/youtube-player/youtube-player.component';
import { extractYoutubeVideoIdPreview } from '../../../shared/utils/youtube-preview';

/**
 * LMS & Study Resources refactor.
 *
 * Google Classroom link is now a single per-Subject setting, managed in its
 * own card right below the subject picker:
 *   no link yet    -> "Add Google Classroom Link" inline input + button
 *   link set       -> read-only link + "Edit Google Classroom Link" (direct
 *                      update, no approval step — unlike the YouTube video
 *                      workflow below)
 * It is set ONCE per subject and never asked for again on lecture uploads.
 *
 * Upload Lecture is a single-step modal again: Title, Description, and
 * YouTube Video Link together. The video is parsed and locked server-side
 * immediately on creation (same instant preview as before, just moved into
 * the upload dialog instead of a separate post-creation step). Editing an
 * already-uploaded lecture's video still goes through the existing
 * "Request Video Change" -> Coordinator/Admin approval workflow, unchanged.
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

  // --- Subject-level Google Classroom link ---
  classroomLink = signal<SubjectClassroomLink | null>(null);
  classroomLinkLoading = signal(false);
  editingClassroomLink = signal(false); // true while the Add/Edit input is shown
  classroomLinkInput = signal('');
  savingClassroomLink = signal(false);

  // --- Lectures list ---
  lectures = signal<Lecture[]>([]);
  lecturesLoading = signal(false);
  lecturesError = signal<string | null>(null);

  // --- Upload Lecture dialog (Title + Description + YouTube Video Link, one step) ---
  uploadDialogOpen = signal(false);
  newTitle = signal('');
  newDescription = signal('');
  newVideoUrl = signal('');
  newVideoPreviewId = computed(() => extractYoutubeVideoIdPreview(this.newVideoUrl()));
  uploading = signal(false);

  // --- Request Video Change dialog (retained intact) ---
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
    this.editingClassroomLink.set(false);
    this.classroomLinkInput.set('');
    if (subjectId) {
      this.loadLectures(subjectId);
      this.loadClassroomLink(subjectId);
    } else {
      this.lectures.set([]);
      this.classroomLink.set(null);
    }
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

  private loadClassroomLink(subjectId: string): void {
    this.classroomLinkLoading.set(true);
    this.teacherContentService.getSubjectClassroomLink(subjectId).subscribe({
      next: (link) => {
        this.classroomLink.set(link);
        this.classroomLinkLoading.set(false);
      },
      error: () => {
        this.classroomLink.set(null);
        this.classroomLinkLoading.set(false);
      },
    });
  }

  // --- Google Classroom link: Add (once) / Edit (direct, no approval) ---
  startEditingClassroomLink(): void {
    this.classroomLinkInput.set(this.classroomLink()?.classroom_url ?? '');
    this.editingClassroomLink.set(true);
  }

  cancelEditingClassroomLink(): void {
    this.editingClassroomLink.set(false);
    this.classroomLinkInput.set('');
  }

  saveClassroomLink(): void {
    const subjectId = this.selectedSubjectId();
    const url = this.classroomLinkInput().trim();
    if (!subjectId) return;
    if (!/^https?:\/\/.+/i.test(url)) {
      Swal.fire({ icon: 'warning', title: 'Invalid link', text: 'The link must start with http:// or https://.' });
      return;
    }

    this.savingClassroomLink.set(true);
    const existing = this.classroomLink();
    const save$ = existing
      ? this.teacherContentService.updateSubjectClassroomLink(subjectId, url)
      : this.teacherContentService.setSubjectClassroomLink(subjectId, url);

    save$.subscribe({
      next: (link) => {
        this.savingClassroomLink.set(false);
        this.classroomLink.set(link);
        this.editingClassroomLink.set(false);
        this.classroomLinkInput.set('');
      },
      error: (err) => {
        this.savingClassroomLink.set(false);
        Swal.fire({ icon: 'error', title: 'Could not save link', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }

  // --- Upload Lecture (single step: Title, Description, YouTube Video Link) ---
  openUploadDialog(): void {
    this.newTitle.set('');
    this.newDescription.set('');
    this.newVideoUrl.set('');
    this.uploadDialogOpen.set(true);
  }

  submitUpload(): void {
    const subjectId = this.selectedSubjectId();
    const title = this.newTitle().trim();
    const videoUrl = this.newVideoUrl().trim();
    if (!subjectId || !title) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'A title is required.' });
      return;
    }
    if (!videoUrl) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'A YouTube video link is required.' });
      return;
    }
    if (!this.newVideoPreviewId()) {
      Swal.fire({
        icon: 'warning',
        title: 'Video not recognized',
        text: 'Paste a full YouTube link (youtube.com/watch?v=..., youtu.be/..., /embed/..., /shorts/...) or an 11-character video ID.',
      });
      return;
    }

    this.uploading.set(true);
    this.teacherContentService
      .createLecture({
        subject_id: subjectId,
        title,
        description: this.newDescription() || null,
        youtube_url: videoUrl,
      })
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

  // --- Request Video Change modal (retained intact) ---
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
