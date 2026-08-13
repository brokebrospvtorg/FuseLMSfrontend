import { MaterialType } from './enums';

/** Mirrors app/models/content.py */

export interface HelpingMaterial {
  id: string;
  subject_id: string;
  subject_name: string;
  material_type: MaterialType;
  title: string;
  description: string | null;
  gcr_link: string;
  uploaded_at: string;
}

export interface Lecture {
  id: string;
  subject_id: string;
  subject_name: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  uploaded_at: string;
}
