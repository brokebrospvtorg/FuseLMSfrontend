import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { APP_CONFIG } from '../config/app-config';

/**
 * Catches a 401 from ANY API call (session expired, cookie invalid,
 * license expired and backend is blocking requests) and redirects to
 * login centrally — so individual services/components don't each need
 * to handle "what if my session died mid-request" themselves.
 *
 * Also backstops `withCredentials: true` on every request to our own API.
 * Every service already sets this manually per-call today, so this isn't
 * fixing a live gap — it's here so a future service can't silently forget
 * it and stop sending the session cookie.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const isOwnApi = req.url.startsWith(APP_CONFIG.apiBaseUrl);
  const request = isOwnApi && !req.withCredentials
    ? req.clone({ withCredentials: true })
    : req;

  return next(request).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authService.clearLocalState();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
