import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { LoginRequest, CurrentUser } from '../models/auth.model';

/**
 * Holds auth state as a signal so any component/guard can read
 * `authService.currentUser()` reactively without subscribing.
 * The actual session lives in the HTTP-Only cookie the backend sets —
 * this signal is just the frontend's in-memory mirror of "who am I",
 * refreshed via /me on app load.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/auth`;

  private readonly _currentUser = signal<CurrentUser | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  constructor(private http: HttpClient) {}

  login(payload: LoginRequest): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>(`${this.baseUrl}/login`, payload, { withCredentials: true })
      .pipe(tap((user) => this._currentUser.set(user)));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this._currentUser.set(null)));
  }

  /** Call on app bootstrap to check for an existing valid session cookie. */
  fetchCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>(`${this.baseUrl}/me`, { withCredentials: true })
      .pipe(tap((user) => this._currentUser.set(user)));
  }

  clearLocalState(): void {
    this._currentUser.set(null);
  }
}
