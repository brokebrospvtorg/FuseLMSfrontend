import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

import { MarksService } from '../../core/services/marks.service';
import { GradeReportEntry, SubjectMarksReport } from '../../core/models/marks.model';

@Component({
  selector: 'app-marks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    TabViewModule,
    TagModule,
    SelectModule,
    ProgressSpinnerModule,
    MessageModule,
  ],
  templateUrl: './marks.component.html',
  styleUrl: './marks.component.scss',
})
export class MarksComponent implements OnInit {
  // --- Grade Report tab ---
  gradeReport = signal<GradeReportEntry[]>([]);
  gradesLoading = signal(true);
  gradesError = signal<string | null>(null);

  // --- Marks Report tab (dropdown-driven) ---
  selectedSubjectId = signal<string | null>(null);
  subjectMarks = signal<SubjectMarksReport | null>(null);
  marksLoading = signal(false);

  // Subject options for the dropdown are derived from the grade report —
  // avoids a second round trip just to list "subjects I'm enrolled in".
  subjectOptions = computed(() =>
    this.gradeReport().map((g) => ({ label: g.subject_name, value: g.subject_id })),
  );

  constructor(private marksService: MarksService) {}

  ngOnInit(): void {
    this.marksService.getMyGradeReport().subscribe({
      next: (data) => {
        this.gradeReport.set(data);
        this.gradesLoading.set(false);
      },
      error: () => {
        this.gradesError.set('Could not load your grade report right now.');
        this.gradesLoading.set(false);
      },
    });
  }

  onSubjectSelected(subjectId: string): void {
    this.selectedSubjectId.set(subjectId);
    this.marksLoading.set(true);
    this.marksService.getMyMarksForSubject(subjectId).subscribe({
      next: (data) => {
        this.subjectMarks.set(data);
        this.marksLoading.set(false);
      },
      error: () => {
        this.marksLoading.set(false);
      },
    });
  }
}
