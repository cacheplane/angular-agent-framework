import { NO_COCKPIT_DOCS_LINK } from '@threadplane/cockpit-registry';

/**
 * Absolute URL for a capability's `docsPath`.
 *
 * `docsPath` is a website-relative path (`/docs/<library>/<section>/<slug>`),
 * but the cockpit is served from its own origin (cockpit.threadplane.ai), so
 * the link has to be absolutised against the docs site.
 *
 * Returns `null` when the capability has no published docs page — callers
 * render no link rather than one that 404s.
 */
export function resolveDocsUrl(docsPath: string | undefined): string | null {
  if (!docsPath || docsPath === NO_COCKPIT_DOCS_LINK) return null;
  if (/^https?:\/\//.test(docsPath)) return docsPath;

  const baseUrl = (
    process.env['NEXT_PUBLIC_COCKPIT_DOCS_BASE_URL'] ?? 'https://threadplane.ai'
  ).replace(/\/$/, '');

  return `${baseUrl}${docsPath.startsWith('/') ? docsPath : `/${docsPath}`}`;
}
