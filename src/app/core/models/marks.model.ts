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
  assessments: MarkEntry[];
}

export interface GradeReportEntry {
  subject_id: string;
  subject_name: string;
  computed_percentage: number | null;
  letter_grade: string | null;
  is_overridden: boolean;
}
