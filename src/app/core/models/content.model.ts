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
  // Lectures Sub-Sprint 1/2: nullable now — a lecture is created empty and
  // the video is set afterward via the dedicated youtube-video endpoint
  // (see TeacherContentService.setYoutubeVideo). Previously required at
  // creation; this interface was still (incorrectly) matching that old
  // shape until now, out of sync with the backend's actual LectureOut.
  youtube_video_id: string | null;
  youtube_video_id_locked: boolean;
  uploaded_by: string;
  uploaded_at: string;
  classroom_url: string | null;
  classroom_url_locked: boolean;
  has_pending_edit_request: boolean; // classroom-url request pending
  has_pending_youtube_edit_request: boolean; // youtube-video request pending — separate flag, separate queue
}

export interface CreateLectureRequest {
  subject_id: string;
  title: string;
  description?: string | null;
  // youtube_video_id deliberately NOT here — LectureCreate on the backend
  // no longer accepts it (Lectures Sub-Sprint 2). A lecture is created
  // empty; the video is set via a separate call afterward.
}

/** Mirrors SetYoutubeVideoRequest / RequestYoutubeEditRequest in schemas/content.py */
export interface SetYoutubeVideoPayload {
  youtube_url: string;
}

export interface RequestYoutubeEditPayload {
  proposed_url: string;
  reason: string;
}

/** Mirrors YoutubeEditRequestOut. */
export interface YoutubeEditRequest {
  id: string;
  lecture_id: string;
  lecture_title: string | null;
  subject_name: string | null;
  current_video_id: string | null;
  requested_by: string;
  requester_name: string | null;
  proposed_url: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Mirrors ClassroomEditRequestOut. */
export interface ClassroomEditRequest {
  id: string;
  lecture_id: string;
  lecture_title: string | null;
  subject_name: string | null;
  current_url: string | null;
  requested_by: string;
  requester_name: string | null;
  proposed_url: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}
