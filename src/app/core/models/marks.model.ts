/** Mirrors app/models/academics_results.py */

export interface Assessment {
  id: string;
  subject_id: string;
  subject_name: string;
  name: string;
  max_marks: number;
}

export interface MarkEntry {
  assessment_id: string;
  assessment_name: string;
  max_marks: number;
  marks_obtained: number;
}

export interface SubjectMarksReport {
  subject_id: string;
  subject_name: string;
  // DB level code (e.g. "AS-LEVEL") — feed into getLevelAbbreviation()
  // (shared/utils/level-badge.util.ts) for the "[AS]" badge. Null if the
  // subject's level was soft-deleted.
  level_code: string | null;
  assessments: MarkEntry[];
}

export interface GradeReportEntry {
  subject_id: string;
  subject_name: string;
  level_code: string | null;
  computed_percentage: number | null;
  letter_grade: string | null;
  // NOTE: no `is_overridden` field — the student portal's grade report
  // never receives override metadata (see app/schemas/student_grades.py).
  // Only Coordinator/Admin-facing GradeOut carries that.
}
