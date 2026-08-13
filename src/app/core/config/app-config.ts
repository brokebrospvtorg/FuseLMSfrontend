/**
 * Single source of truth for app-wide config that differs between
 * local dev and production (currently just the API base URL).
 *
 * Kept as a plain constant rather than Angular's old environment.ts/
 * environment.prod.ts pattern — this is a one-time single-deployment
 * app, not a multi-environment SaaS, so the extra fileReplacements
 * build-config wiring isn't worth the ceremony. If FUSE LMS ever needs
 * staging/prod/multiple client deployments, migrate this to proper
 * environment files at that point.
 */
export const APP_CONFIG = {
  apiBaseUrl: 'http://localhost:8000/api',
} as const;
