import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { HelpingMaterial, Lecture } from '../models/content.model';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/content`;

  constructor(private http: HttpClient) {}

  /** Only returns materials for subjects the student has (or had) an enrollment in —
   *  access is enforced server-side, this call just returns what the backend allows. */
  getMyMaterials(): Observable<HelpingMaterial[]> {
    return this.http.get<HelpingMaterial[]>(`${this.baseUrl}/materials/me`, { withCredentials: true });
  }

  getMyLectures(): Observable<Lecture[]> {
    return this.http.get<Lecture[]>(`${this.baseUrl}/lectures/me`, { withCredentials: true });
  }
}
