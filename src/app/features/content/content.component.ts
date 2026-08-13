import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ContentService } from '../../core/services/content.service';
import { HelpingMaterial, Lecture } from '../../core/models/content.model';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TableModule,
    TabViewModule,
    TagModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './content.component.html',
  styleUrl: './content.component.scss',
})
export class ContentComponent implements OnInit {
  materials = signal<HelpingMaterial[]>([]);
  materialsLoading = signal(true);
  materialsError = signal<string | null>(null);

  lectures = signal<Lecture[]>([]);
  lecturesLoading = signal(true);
  lecturesError = signal<string | null>(null);

  constructor(
    private contentService: ContentService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.contentService.getMyMaterials().subscribe({
      next: (data) => {
        this.materials.set(data);
        this.materialsLoading.set(false);
      },
      error: () => {
        this.materialsError.set('Could not load materials right now.');
        this.materialsLoading.set(false);
      },
    });

    this.contentService.getMyLectures().subscribe({
      next: (data) => {
        this.lectures.set(data);
        this.lecturesLoading.set(false);
      },
      error: () => {
        this.lecturesError.set('Could not load lectures right now.');
        this.lecturesLoading.set(false);
      },
    });
  }

  /** Unlisted-video embed — see content.model.ts note re: this only blocks
   *  browsing, not a copied-link being shared outside FUSE (known v1 trade-off). */
  embedUrl(videoId: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
  }
}
