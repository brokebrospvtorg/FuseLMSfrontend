import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ContentService } from '../../../core/services/content.service';
import { HelpingMaterial, Lecture } from '../../../core/models/content.model';
import { MaterialType } from '../../../core/models/enums';
import { YoutubePlayerComponent } from '../../../shared/ui/youtube-player/youtube-player.component';

/** One card in the Subject Selection grid — derived from whatever
 *  subjects actually show up across the student's own lectures and
 *  helping materials (both endpoints are already scoped server-side to
 *  the student's enrollments), not a separate "my subjects" call. */
interface SubjectSummary {
  subject_id: string;
  subject_name: string;
  lectureCount: number;
  materialCount: number;
}

const MATERIAL_TYPE_LABEL: Record<MaterialType, string> = {
  [MaterialType.Notes]: 'Notes',
  [MaterialType.Worksheet]: 'Worksheet',
  [MaterialType.PastPaper]: 'Past Paper',
  [MaterialType.Other]: 'Other',
};

/**
 * LMS & Study Resources — Student "Lectures" screen.
 *
 * Subject Selection: rather than dumping every enrolled subject's
 * lectures into one long grid, the screen opens on a list of clickable
 * Subject cards (derived from the student's own lectures + helping
 * materials, both already scoped server-side to their enrollments).
 *
 * Filtered View: clicking a Subject card scopes the screen to that
 * subject only — its recorded lectures (YouTube embeds, via the shared
 * <app-youtube-player>) and its Helping Materials (notes/worksheets/
 * past papers, each a title + description + link to the file) — with a
 * "Back to Subjects" control to return to the card grid. Google
 * Classroom stays out of this screen on purpose — that's still its own
 * per-Subject destination (see GoogleClassroomComponent /
 * /student/materials), unchanged.
 */
@Component({
  selector: 'app-lectures-catalog',
  standalone: true,
  imports: [
    CommonModule, CardModule, ButtonModule, TagModule, ProgressSpinnerModule, MessageModule,
    YoutubePlayerComponent,
  ],
  templateUrl: './lectures-catalog.component.html',
  styleUrl: './lectures-catalog.component.scss',
})
export class LecturesCatalogComponent implements OnInit {
  lectures = signal<Lecture[]>([]);
  materials = signal<HelpingMaterial[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  /** null = showing the Subject Selection grid; set = Filtered View. */
  selectedSubjectId = signal<string | null>(null);

  subjects = computed<SubjectSummary[]>(() => {
    const bySubject = new Map<string, SubjectSummary>();

    for (const lecture of this.lectures()) {
      const entry = bySubject.get(lecture.subject_id) ?? {
        subject_id: lecture.subject_id,
        subject_name: lecture.subject_name,
        lectureCount: 0,
        materialCount: 0,
      };
      entry.lectureCount += 1;
      bySubject.set(lecture.subject_id, entry);
    }

    for (const material of this.materials()) {
      const entry = bySubject.get(material.subject_id) ?? {
        subject_id: material.subject_id,
        subject_name: material.subject_name,
        lectureCount: 0,
        materialCount: 0,
      };
      entry.materialCount += 1;
      bySubject.set(material.subject_id, entry);
    }

    return Array.from(bySubject.values()).sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  });

  selectedSubject = computed<SubjectSummary | null>(() => {
    const id = this.selectedSubjectId();
    return id ? (this.subjects().find((s) => s.subject_id === id) ?? null) : null;
  });

  filteredLectures = computed<Lecture[]>(() => {
    const id = this.selectedSubjectId();
    return id ? this.lectures().filter((l) => l.subject_id === id) : [];
  });

  filteredMaterials = computed<HelpingMaterial[]>(() => {
    const id = this.selectedSubjectId();
    return id ? this.materials().filter((m) => m.subject_id === id) : [];
  });

  constructor(private contentService: ContentService) {}

  ngOnInit(): void {
    this.contentService.getMyLectures().subscribe({
      next: (data) => this.lectures.set(data),
      error: () => this.error.set('Could not load lectures right now.'),
      complete: () => this.finishLoadingStep(),
    });
    this.contentService.getMyMaterials().subscribe({
      next: (data) => this.materials.set(data),
      error: () => this.error.set('Could not load helping materials right now.'),
      complete: () => this.finishLoadingStep(),
    });
  }

  /** Both calls fire in parallel on init; only clear the spinner once
   *  both have settled, so the Subject grid isn't built off a partial
   *  (lectures-only or materials-only) result. */
  private pendingRequests = 2;
  private finishLoadingStep(): void {
    this.pendingRequests -= 1;
    if (this.pendingRequests <= 0) {
      this.loading.set(false);
    }
  }

  selectSubject(subjectId: string): void {
    this.selectedSubjectId.set(subjectId);
  }

  backToSubjects(): void {
    this.selectedSubjectId.set(null);
  }

  materialTypeLabel(type: MaterialType): string {
    return MATERIAL_TYPE_LABEL[type] ?? 'Other';
  }
}
