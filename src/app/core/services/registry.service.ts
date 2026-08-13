import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { RegistryUser, CreateUserRequest, UpdateUserRequest } from '../models/registry.model';

/**
 * 5.2 gave us the read side. 5.3 adds the write side: create, edit role,
 * suspend/reactivate — all backed by the same admin+coordinator-gated
 * endpoints verified/hardened in 5.1 (app/routers/users.py).
 */
@Injectable({ providedIn: 'root' })
export class RegistryService {
  private readonly apiBaseUrl = APP_CONFIG.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getUsers(role?: string): Observable<RegistryUser[]> {
    const url = role ? `${this.apiBaseUrl}/users?role=${role}` : `${this.apiBaseUrl}/users`;
    return this.http.get<RegistryUser[]>(url, { withCredentials: true });
  }

  createUser(payload: CreateUserRequest): Observable<RegistryUser> {
    return this.http.post<RegistryUser>(`${this.apiBaseUrl}/users`, payload, { withCredentials: true });
  }

  updateUser(userId: string, payload: UpdateUserRequest): Observable<RegistryUser> {
    return this.http.patch<RegistryUser>(`${this.apiBaseUrl}/users/${userId}`, payload, { withCredentials: true });
  }
}
