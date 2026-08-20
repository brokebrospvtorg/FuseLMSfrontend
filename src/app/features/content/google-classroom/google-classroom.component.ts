import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ContentService } from '../../../core/services/content.service';
import { SubjectClassroomLink } from '../../../core/models/content.model';

/**
 * LMS & Study Resources refactor — Student "Google Classroom / Notes"
 * screen. Previously this route (`/student/materials`) rendered a
 * ContentComponent with two inner sub-tabs ("Lecture Materials" and
 * "Lectures"); both are gone. This is now a direct, single-purpose screen:
 * one card per enrolled subject that has a Google Classroom link, each
 * with a plain "Open Google Classroom" button that opens the link in a
 * new tab. No tables, no per-material rows, no tabs.
 */
@Component({
  selector: 'app-google-classroom',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ProgressSpinnerModule, MessageModule],
  templateUrl: './google-classroom.component.html',
  styleUrl: './google-classroom.component.scss',
})
export class GoogleClassroomComponent implements OnInit {
  links = signal<SubjectClassroomLink[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(private contentService: ContentService) {}

  ngOnInit(): void {
    this.contentService.getMyClassroomLinks().subscribe({
      next: (data) => {
        this.links.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load your Google Classroom links right now.');
        this.loading.set(false);
      },
    });
  }
}
