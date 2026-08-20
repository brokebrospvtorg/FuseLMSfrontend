import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { MyProfile } from '../models/user.model';
import { User } from '../models/user.model';
import { UserRole } from '../models/enums';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/users`;

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<MyProfile> {
    return this.http.get<MyProfile>(`${this.baseUrl}/me/profile`, { withCredentials: true });
  }

  /** GET /api/users?role=<role> — Admin/Coordinator only server-side.
   *  Used by the Admin "Manage Subjects & Teachers" dialog to populate
   *  the Teacher picker from the Information Registry (UserRole.Teacher
   *  -> 'teacher', matching the plain-string role column on User). */
  getUsersByRole(role: UserRole): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl, {
      params: { role },
      withCredentials: true,
    });
  }
}
