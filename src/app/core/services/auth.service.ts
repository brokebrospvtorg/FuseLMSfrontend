import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { LoginRequest, CurrentUser } from '../models/auth.model';

const SESSION_STORAGE_KEY = 'fuse_current_user';

/**
 * Holds auth state as a signal so any component/guard can read
 * `authService.currentUser()` reactively without subscribing.
 * The actual session lives in the HTTP-Only cookie the backend sets —
 * this signal is just the frontend's in-memory mirror of "who am I",
 * refreshed via /me on app load.
 *
 * sessionStorage note (Sub-Sprint 1.2): the cookie itself is HttpOnly, so
 * JS can't read it — there's nothing to "persist" about the session token
 * itself, and there shouldn't be (storing a JWT in sessionStorage would be
 * a step backward, not forward, since it becomes readable to any script on
 * the page). What sessionStorage DOES help with here is the *display*
 * flicker on a hard refresh: without it, the topbar/sidebar briefly render
 * with no name/role while the async /me round-trip is in flight. We cache
 * the last-known CurrentUser (non-sensitive: id, name, email, role) so the
 * UI can paint immediately, then treat it as provisional until fetchCurrentUser()
 * confirms or clears it. authGuard still always calls fetchCurrentUser() on
 * a cold load — this cache never substitutes for that server round-trip,
 * so a stale or hand-edited sessionStorage value can't grant access to
 * anything: every real endpoint still requires the actual cookie and
 * re-checks the role server-side regardless of what the frontend thinks.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/auth`;

  private readonly _currentUser = signal<CurrentUser | null>(this.readCachedUser());
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /**
   * True once fetchCurrentUser() has actually round-tripped to the server
   * during this app boot (resets on a hard reload, since it's just a plain
   * class field, not persisted anywhere). authGuard uses this — not
   * isAuthenticated() alone — to decide whether it can trust the signal or
   * still needs to confirm with /me. This is what stops the sessionStorage
   * optimistic cache from ever being the sole basis for a route decision.
   */
  hasVerifiedSession = false;

  constructor(private http: HttpClient) {}

  login(payload: LoginRequest): Observable<CurrentUser> {
    return this.http
      .post<CurrentUser>(`${this.baseUrl}/login`, payload, { withCredentials: true })
      .pipe(tap((user) => {
        this.setUser(user);
        this.hasVerifiedSession = true;
      }));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this.clearLocalState()));
  }

  /** Call on app bootstrap (or from authGuard) to check for an existing valid session cookie. */
  fetchCurrentUser(): Observable<CurrentUser> {
    return this.http
      .get<CurrentUser>(`${this.baseUrl}/me`, { withCredentials: true })
      .pipe(tap((user) => {
        this.setUser(user);
        this.hasVerifiedSession = true;
      }));
  }

  clearLocalState(): void {
    this._currentUser.set(null);
    this.hasVerifiedSession = false;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  private setUser(user: CurrentUser): void {
    this._currentUser.set(user);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  }

  private readCachedUser(): CurrentUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CurrentUser) : null;
    } catch {
      // Corrupted/hand-edited value — ignore it and fall through to the
      // normal /me check rather than crashing app bootstrap over it.
      return null;
    }
  }
}
