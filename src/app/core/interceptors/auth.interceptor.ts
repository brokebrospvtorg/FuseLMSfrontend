import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Catches a 401 from ANY API call (session expired, cookie invalid,
 * license expired and backend is blocking requests) and redirects to
 * login centrally — so individual services/components don't each need
 * to handle "what if my session died mid-request" themselves.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        authService.clearLocalState();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
