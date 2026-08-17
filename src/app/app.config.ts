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
 * IMPORTANT: replace the placeholder below with your actual Railway
 * backend URL (Railway dashboard -> your service -> Settings -> Domains).
 * It'll look like https://fuse-lms-backend-production.up.railway.app
 */
const PRODUCTION_API_BASE_URL = 'https://YOUR-RAILWAY-APP.up.railway.app/api';
const LOCAL_API_BASE_URL = 'http://localhost:8000/api';

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const APP_CONFIG = {
  apiBaseUrl: isLocalHost ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL,
} as const;
