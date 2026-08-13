import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Required by PrimeNG's overlay-based components (p-select, p-dialog,
    // p-tooltip, etc.) to open/close their panels. Without this, clicking
    // a p-select does nothing visible — the panel's animation trigger
    // never fires, even though the component itself is wired correctly.
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        // Without this, PrimeNG auto-switches every component (cards, inputs,
        // buttons) to its dark palette whenever the OS/browser is in dark mode —
        // which silently breaks any custom colors built assuming a light theme
        // (exactly what happened: dark navy text on a now-dark card background).
        // Forcing this off keeps the app looking the same for every user.
        options: {
          darkModeSelector: false,
        },
      },
    }),
  ],
};
