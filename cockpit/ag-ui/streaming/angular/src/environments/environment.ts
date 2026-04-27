/**
 * Production environment configuration.
 *
 * Uses relative /agent URL — configure a reverse proxy or Vercel rewrite
 * to forward requests to the AG-UI backend.
 */
export const environment = {
  production: true,
  agUiUrl: '/agent',
};
