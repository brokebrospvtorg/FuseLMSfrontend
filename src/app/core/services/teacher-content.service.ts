import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import {
  Lecture, CreateLectureRequest, SubjectClassroomLink,
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

  /** LMS & Study Resources refactor: Title, Description, and YouTube Video
   *  Link are all submitted together — video is parsed & locked server-side
   *  immediately on creation. No Google Classroom field here anymore. */
  createLecture(payload: CreateLectureRequest): Observable<Lecture> {
    return this.http.post<Lecture>(`${this.baseUrl}/lectures`, payload, { withCredentials: true });
  }

  // --- Subject-level Google Classroom link (replaces the old per-lecture
  //     setClassroomUrl/requestClassroomEdit pair above) ---

  /** Returns null when no link has been set for this subject yet — that's
   *  the normal "show Add Google Classroom Link" state, not an error. */
  getSubjectClassroomLink(subjectId: string): Observable<SubjectClassroomLink | null> {
    return this.http.get<SubjectClassroomLink | null>(
      `${this.baseUrl}/subjects/${subjectId}/classroom-link`,
      { withCredentials: true },
    );
  }

  /** "Add Google Classroom Link" — initial set only; backend 409s if the
   *  subject already has one. */
  setSubjectClassroomLink(subjectId: string, classroomUrl: string): Observable<SubjectClassroomLink> {
    return this.http.post<SubjectClassroomLink>(
      `${this.baseUrl}/subjects/${subjectId}/classroom-link`,
      { classroom_url: classroomUrl },
      { withCredentials: true },
    );
  }

  /** "Edit Google Classroom Link" — direct update, no approval step. */
  updateSubjectClassroomLink(subjectId: string, classroomUrl: string): Observable<SubjectClassroomLink> {
    return this.http.put<SubjectClassroomLink>(
      `${this.baseUrl}/subjects/${subjectId}/classroom-link`,
      { classroom_url: classroomUrl },
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
