/**
 * Single source of truth for app-wide config that differs between
 * local dev and production (currently just the API base URL).
 *
 * Runtime hostname check instead of Angular's environment.ts/
 * environment.prod.ts file-replacement pattern — this is a one-time
 * single-deployment app, not a multi-environment SaaS, so the extra
 * fileReplacements build-config wiring isn't worth the ceremony. This way
 * the SAME build works correctly whether it's running via `ng serve` on
 * localhost or deployed on Vercel — no separate prod build step to forget.
 *
 */
// PRODUCTION_API_BASE_URL used to point straight at the Railway origin
// (https://fuselmsback-production.up.railway.app/api). That made every
// request cross-site from the browser's point of view (Vercel domain !=
// Railway domain), which meant the auth/CSRF cookies were third-party
// cookies — and WebKit (Safari + Chrome-on-iOS both use it) blocks or
// evicts those by default under Intelligent Tracking Prevention. That's
// what caused the immediate logout-back-to-/login loop on iPhone: the
// login response set the cookie, but the browser refused to keep it, so
// the very next request came back 401.
//
// Fix: route through a same-origin path instead. vercel.json rewrites
// /api/:path* to the Railway backend at the edge, so the browser only
// ever talks to its own domain and the cookie is first-party. See
// vercel.json at the repo root.
const PRODUCTION_API_BASE_URL = '/api';
const LOCAL_API_BASE_URL = 'http://localhost:8000/api';

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const APP_CONFIG = {
  apiBaseUrl: isLocalHost ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL,
} as const;
