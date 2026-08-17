import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import {
  Lecture, CreateLectureRequest, ClassroomEditRequest,
  SetYoutubeVideoPayload, RequestYoutubeEditPayload, YoutubeEditRequest,
} from '../models/content.model';

/**
 * Kept separate from ContentService (the Student-side "my accessible
 * content" reader) since Teacher's needs are structurally different:
 * subject-scoped queries with a `mine` filter, plus the classroom-link
 * workflow endpoints that only a Teacher (owner of the lecture) can call.
 */
@Injectable({ providedIn: 'root' })
export class TeacherContentService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/content`;

  constructor(private http: HttpClient) {}

  getLecturesForSubject(subjectId: string, mineOnly = true): Observable<Lecture[]> {
    const params = new HttpParams().set('subject_id', subjectId).set('mine', String(mineOnly));
    return this.http.get<Lecture[]>(`${this.baseUrl}/lectures`, { params, withCredentials: true });
  }

  createLecture(payload: CreateLectureRequest): Observable<Lecture> {
    return this.http.post<Lecture>(`${this.baseUrl}/lectures`, payload, { withCredentials: true });
  }

  /** Task 1.3 — initial set only; backend 409s if a link is already locked in. */
  setClassroomUrl(lectureId: string, classroomUrl: string): Observable<Lecture> {
    return this.http.post<Lecture>(
      `${this.baseUrl}/lectures/${lectureId}/classroom-url`,
      { classroom_url: classroomUrl },
      { withCredentials: true },
    );
  }

  /** Task 1.4 — proposes a change to an already-locked link; goes to the Coordinator/Admin queue. */
  requestClassroomEdit(lectureId: string, proposedUrl: string, reason: string): Observable<ClassroomEditRequest> {
    return this.http.post<ClassroomEditRequest>(
      `${this.baseUrl}/lectures/${lectureId}/request-edit`,
      { proposed_url: proposedUrl, reason },
      { withCredentials: true },
    );
  }

  /**
   * Lectures Sub-Sprint 2 — initial video set only. Accepts a full YouTube
   * URL (any recognized format) or a bare 11-char ID; the backend parses
   * and validates it (parse_youtube_video_id) before storing. 409s if
   * youtube_video_id_locked is already true — that's what
   * requestYoutubeEdit below is for instead.
   */
  setYoutubeVideo(lectureId: string, youtubeUrl: string): Observable<Lecture> {
    const payload: SetYoutubeVideoPayload = { youtube_url: youtubeUrl };
    return this.http.post<Lecture>(`${this.baseUrl}/lectures/${lectureId}/youtube-video`, payload, {
      withCredentials: true,
    });
  }

  /** Proposes a change to an already-locked video; goes to the Coordinator/Admin queue (Sub-Sprint 6). */
  requestYoutubeEdit(lectureId: string, proposedUrl: string, reason: string): Observable<YoutubeEditRequest> {
    const payload: RequestYoutubeEditPayload = { proposed_url: proposedUrl, reason };
    return this.http.post<YoutubeEditRequest>(`${this.baseUrl}/lectures/${lectureId}/request-youtube-edit`, payload, {
      withCredentials: true,
    });
  }
}
