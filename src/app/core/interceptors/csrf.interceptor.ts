import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { AuthService } from '../services/auth.service';
import { APP_CONFIG } from '../config/app-config';

const CSRF_HEADER_NAME = 'X-CSRF-Token';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Attaches the CSRF token (captured from the X-CSRF-Token response header
 * on /login and /me — see AuthService) to every state-changing request
 * against our own API. GET/HEAD/OPTIONS are left alone, and requests to
 * any other host (e.g. Google Fonts preconnects, none currently via
 * HttpClient, but as a safety rail) never get the token attached.
 *
 * NOTE: this intentionally does NOT use Angular's built-in
 * HttpClientXsrfModule/withXsrfConfiguration — that reads the token from
 * document.cookie, which only works when the cookie's domain matches the
 * page's own origin. Our backend (Railway) and frontend (Vercel) are on
 * different domains, so a cookie set by the backend is never visible to
 * document.cookie here. This interceptor reads the token from AuthService
 * instead, where it was captured from a response header/body — see the
 * backend fix notes for why.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const isStateChanging = STATE_CHANGING_METHODS.has(req.method.toUpperCase());
  const isOwnApi = req.url.startsWith(APP_CONFIG.apiBaseUrl);

  if (!isStateChanging || !isOwnApi) {
    return next(req);
  }

  const token = authService.csrfToken();
  if (!token) {
    // No token yet (e.g. a mutating call fired before /login or /me ever
    // completed) — let it through as-is; the backend will reject it with
    // 403 rather than the frontend silently guessing a value.
    return next(req);
  }

  return next(req.clone({ setHeaders: { [CSRF_HEADER_NAME]: token } }));
};