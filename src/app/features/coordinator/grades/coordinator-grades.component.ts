import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputTextModule } from 'primeng/inputtext';

import { AcademicsStaffService } from '../../../core/services/academics-staff.service';
import { Subject, Batch, Level } from '../../../core/models/academic.model';
import { GradeFull, AuditLogEntry } from '../../../core/models/academics-staff.model';

/** GradeFull plus a display name joined in client-side from the roster (GradeOut has no name field). */
interface GradeRow extends GradeFull {
  student_name: string;
}

@Component({
  selector: 'app-coordinator-grades',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CardModule, TableModule, SelectModule, ButtonModule,
    DialogModule, TextareaModule, TagModule, ProgressSpinnerModule, InputTextModule,
  ],
  templateUrl: './coordinator-grades.component.html',
  styleUrl: './coordinator-grades.component.scss',
})
export class CoordinatorGradesComponent implements OnInit {
  levels = signal<Level[]>([]);
  subjects = signal<Subject[]>([]);
  batches = signal<Batch[]>([]);
  pickerLoading = signal(true);

  selectedLevelId = signal<string | null>(null);
  selectedSubjectId = signal<string | null>(null);
  selectedBatchId = signal<string | null>(null);

  levelOptions = computed(() => this.levels().map((l) => ({ label: l.name, value: l.id })));
  // Requirement: filter by Class (Level), Subject, Batch. Subject list narrows
  // to the selected Level; picking a Level clears a Subject that no longer fits.
  subjectOptions = computed(() => {
    const levelId = this.selectedLevelId();
    const pool = levelId ? this.subjects().filter((s) => s.level_id === levelId) : this.subjects();
    return pool.map((s) => ({ label: s.name, value: s.id }));
  });
  batchOptions = computed(() => this.batches().map((b) => ({ label: b.name, value: b.id })));

  grades = signal<GradeRow[]>([]);
  gradesLoading = signal(false);

  // Requirement: filter by Student too, within the pulled-up roster —
  // lighter-weight than a separate picker since the roster's already small
  // once Subject+Batch narrow it down.
  studentSearch = signal('');
  visibleGrades = computed(() => {
    const term = this.studentSearch().trim().toLowerCase();
    if (!term) return this.grades();
    return this.grades().filter((g) => g.student_name.toLowerCase().includes(term));
  });

  // --- Class average & grade distribution (Sub-Sprint 2 requirement) ---
  // Derived entirely from the already-loaded `grades` signal — no extra
  // backend call needed. Deliberately reads from `grades()` (the full
  // subject+batch set), not `visibleGrades()`, so the student-search box
  // narrows the table without skewing the class-wide analytics.
  classAverage = computed(() => {
    const withPercentage = this.grades().filter((g) => g.computed_percentage !== null);
    if (withPercentage.length === 0) return null;
    const sum = withPercentage.reduce((acc, g) => acc + Number(g.computed_percentage), 0);
    return Math.round((sum / withPercentage.length) * 10) / 10;
  });

  gradeDistribution = computed(() => {
    const counts = new Map<string, number>();
    for (const g of this.grades()) {
      const key = g.letter_grade ?? 'Not yet graded';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const total = this.grades().length || 1;
    return Array.from(counts.entries())
      .map(([letter_grade, count]) => ({ letter_grade, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  });

  // --- Audit trail (Sub-Sprint 6.3 requirement: history of past overrides) ---
  auditHistory = signal<AuditLogEntry[]>([]);
  auditLoading = signal(false);

  // --- Override dialog ---
  overrideDialogOpen = signal(false);
  overridingGrade = signal<GradeRow | null>(null);
  overrideLetterGrade = signal('');
  overrideReason = signal('');
  submittingOverride = signal(false);
  // Disabled (not just validated-on-click) per spec: "disabled if left blank".
  canSubmitOverride = computed(() => !!this.overrideLetterGrade().trim() && !!this.overrideReason().trim());

  constructor(private staffService: AcademicsStaffService) {}

  ngOnInit(): void {
    this.staffService.getLevels().subscribe((levels) => {
      this.levels.set(levels);
      this.staffService.getSubjects().subscribe((s) => {
        this.subjects.set(s);
        this.staffService.getBatches().subscribe((b) => {
          this.batches.set(b);
          this.pickerLoading.set(false);
        });
      });
    });
  }

  onLevelChanged(levelId: string | null): void {
    this.selectedLevelId.set(levelId);
    // Clear a subject selection that's no longer valid for this level.
    const stillValid = this.subjects().some(
      (s) => s.id === this.selectedSubjectId() && (!levelId || s.level_id === levelId),
    );
    if (!stillValid) {
      this.selectedSubjectId.set(null);
      this.grades.set([]);
      this.auditHistory.set([]);
    }
  }

  onFiltersChanged(): void {
    const subjectId = this.selectedSubjectId();
    const batchId = this.selectedBatchId();
    if (!subjectId || !batchId) {
      this.grades.set([]);
      this.auditHistory.set([]);
      return;
    }
    this.gradesLoading.set(true);
    this.staffService.getGrades(subjectId, batchId).subscribe({
      next: (grades) => {
        // Join in display names from the roster — GradeOut only has student_id.
        this.staffService.getRoster(subjectId, batchId).subscribe({
          next: (roster) => {
            const namesByStudent = new Map(roster.map((r) => [r.student_id, r.full_name]));
            this.grades.set(
              grades.map((g) => ({ ...g, student_name: namesByStudent.get(g.student_id) ?? g.student_id })),
            );
            this.gradesLoading.set(false);
          },
          error: () => {
            this.grades.set(grades.map((g) => ({ ...g, student_name: g.student_id })));
            this.gradesLoading.set(false);
          },
        });
      },
      error: () => this.gradesLoading.set(false),
    });

    this.loadAuditHistory(subjectId, batchId);
  }

  private loadAuditHistory(subjectId: string, batchId: string): void {
    this.auditLoading.set(true);
    this.staffService.getGradeAuditHistory(subjectId, batchId).subscribe({
      next: (entries) => {
        this.auditHistory.set(entries);
        this.auditLoading.set(false);
      },
      error: () => this.auditLoading.set(false),
    });
  }

  openOverrideDialog(grade: GradeRow): void {
    this.overridingGrade.set(grade);
    this.overrideLetterGrade.set(grade.letter_grade ?? '');
    this.overrideReason.set('');
    this.overrideDialogOpen.set(true);
  }

  submitOverride(): void {
    const grade = this.overridingGrade();
    const letterGrade = this.overrideLetterGrade().trim();
    const reason = this.overrideReason().trim();

    if (!grade || !letterGrade || !reason) {
      Swal.fire({ icon: 'warning', title: 'Missing info', text: 'Enter both the new grade and a reason.' });
      return;
    }

    this.submittingOverride.set(true);
    this.staffService.overrideGrade(grade.id, { letter_grade: letterGrade, override_reason: reason }).subscribe({
      next: () => {
        this.submittingOverride.set(false);
        this.overrideDialogOpen.set(false);
        Swal.fire({
          icon: 'success',
          title: 'Grade overridden',
          text: 'The change was logged to the audit log and the original teacher was notified.',
          timer: 2200,
          showConfirmButton: false,
        });
        this.onFiltersChanged(); // refreshes both grades and audit history
      },
      error: (err) => {
        this.submittingOverride.set(false);
        Swal.fire({ icon: 'error', title: 'Could not override grade', text: err?.error?.detail ?? 'Please try again.' });
      },
    });
  }
}
