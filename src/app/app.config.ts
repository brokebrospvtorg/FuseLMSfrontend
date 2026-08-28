import { ApplicationConfig, InjectionToken } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { csrfInterceptor } from './core/interceptors/csrf.interceptor';

// 1. Ek InjectionToken define karein taake baki services ise use kar sakein
export const API_URL = new InjectionToken<string>('API_URL');

export const appConfig: ApplicationConfig = {
  providers: [
    // 2. Yahan apni base URL ko as a provider register kar dein
    { provide: API_URL, useValue: 'https://fuselmsback-production.up.railway.app' },

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