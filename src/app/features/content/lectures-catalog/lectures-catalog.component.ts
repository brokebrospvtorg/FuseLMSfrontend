import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ContentService } from '../../../core/services/content.service';
import { Lecture } from '../../../core/models/content.model';
import { YoutubePlayerComponent } from '../../../shared/ui/youtube-player/youtube-player.component';

/**
 * LMS & Study Resources refactor — Student "Lectures" screen. Strictly the
 * YouTube video catalog / embedded player list now: the old "Lecture
 * Materials" sub-tab and the per-lecture "Open Google Classroom" button
 * that used to live in this same tabbed view are both gone — Google
 * Classroom now lives exclusively on the LMS & Study Resources screen
 * (see GoogleClassroomComponent), one link per subject, not per lecture.
 */
@Component({
  selector: 'app-lectures-catalog',
  standalone: true,
  imports: [CommonModule, CardModule, ProgressSpinnerModule, MessageModule, YoutubePlayerComponent],
  templateUrl: './lectures-catalog.component.html',
  styleUrl: './lectures-catalog.component.scss',
})
export class LecturesCatalogComponent implements OnInit {
  lectures = signal<Lecture[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private contentService: ContentService) {}

  ngOnInit(): void {
    this.contentService.getMyLectures().subscribe({
      next: (data) => {
        this.lectures.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load lectures right now.');
        this.loading.set(false);
      },
    });
  }
}
