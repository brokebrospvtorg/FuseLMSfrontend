/** Mirrors app/schemas/parent.py */

// Pehle agar MarkEntry kisi aur file (jaise student ya teacher model) mein hai to yahan import kar lein, 
// nahi to niche humne inline define kar diya hai.

export interface MarkEntry {
  evaluation_type_name: string; // e.g., 'Quiz 1', 'Midterm', 'Assignment 2'
  obtained_marks: number;
  total_marks: number;
  weightage_percentage?: number; 
  remarks?: string | null;
}

export interface ParentChild {
  student_id: string;
  full_name: string;
  roll_number: string | null;
  relationship: string | null;
}

export interface ParentChildOverview {
  student_id: string;
  full_name: string;
  current_batch_name: string | null;
  current_batch_year: number | null;
  overall_attendance_percentage: number | null;
  aggregate_grade_percentage: number | null;
}

export interface ParentSubjectTranscript {
  subject_id: string;
  subject_name: string;
  computed_percentage: number | null;
  letter_grade: string | null;
  is_overridden: boolean;
  assessments: MarkEntry[];
}