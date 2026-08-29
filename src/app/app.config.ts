import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { csrfInterceptor } from './core/interceptors/csrf.interceptor';

// NOTE: there used to be a second, separate API_URL InjectionToken here,
// hardcoded to the Railway origin. Nothing actually injected it (every
// real service reads APP_CONFIG.apiBaseUrl instead — see
// core/config/app-config.ts), so it wasn't live, but a hardcoded
// cross-site origin sitting in providers is exactly the kind of thing
// that gets wired into a new service later and quietly reintroduces the
// iOS cookie-blocking bug. Removed. If something new needs the API base
// URL, inject APP_CONFIG from core/config/app-config.ts.

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    // csrfInterceptor must run before authInterceptor: it needs to attach
    // the token to the outgoing request; authInterceptor only reacts to
    // 401s on the way back, so order between them doesn't affect that half,
    // but keeping the "attach" step first reads more naturally top-to-bottom.
    provideHttpClient(withInterceptors([csrfInterceptor, authInterceptor])),
    
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false,
        },
      },
    }),
  ],
};