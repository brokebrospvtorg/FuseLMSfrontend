import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { ParentService } from '../../../core/services/parent.service';
import { ParentChild, ParentSubjectTranscript } from '../../../core/models/parent.model';

@Component({
  selector: 'app-parent-report-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    TagModule,
    SelectModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './parent-report-card.component.html',
  styleUrl: './parent-report-card.component.scss',
})
export class ParentReportCardComponent implements OnInit {
  children = signal<ParentChild[]>([]);
  childrenLoading = signal(true);
  childrenError = signal<string | null>(null);

  selectedChild = signal<ParentChild | null>(null);

  transcript = signal<ParentSubjectTranscript[]>([]);
  transcriptLoading = signal(false);
  transcriptError = signal<string | null>(null);

  constructor(private parentService: ParentService) {}

  ngOnInit(): void {
    this.parentService.getMyChildren().subscribe({
      next: (children) => {
        this.children.set(children);
        this.childrenLoading.set(false);
        if (children.length > 0) {
          this.onChildChange(children[0]);
        }
      },
      error: () => {
        this.childrenError.set('Could not load your linked children right now.');
        this.childrenLoading.set(false);
      },
    });
  }

  onChildChange(child: ParentChild | null): void {
    this.selectedChild.set(child);
    if (!child) {
      this.transcript.set([]);
      return;
    }
    this.transcriptLoading.set(true);
    this.transcriptError.set(null);
    this.parentService.getChildReportCard(child.student_id).subscribe({
      next: (data) => {
        // Defensive normalization: guarantees `assessments` is always an
        // array before it ever reaches the template's `.length` check /
        // p-table binding, even if a subject somehow comes back from the
        // API without one. ParentSubjectTranscriptOut defaults assessments
        // to [] server-side, so this is a belt-and-suspenders guard, not a
        // sign the backend is expected to omit it.
        this.transcript.set((data ?? []).map((subject) => ({
          ...subject,
          assessments: subject.assessments ?? [],
        })));
        this.transcriptLoading.set(false);
      },
      error: () => {
        this.transcriptError.set('Could not load the report card right now.');
        this.transcriptLoading.set(false);
      },
    });
  }

  severityFor(pct: number | null): 'success' | 'warn' | 'danger' | 'info' {
    if (pct === null) return 'info';
    if (pct >= 70) return 'success';
    if (pct >= 50) return 'warn';
    return 'danger';
  }
}
