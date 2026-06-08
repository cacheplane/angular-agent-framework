// Leaf module: the canonical site origin with NO Node-only (`fs`) imports, so it
// is safe to import from `'use client'` components. `site-metadata.ts` re-exports
// it; client code should import from here directly.
export const SITE_ORIGIN = 'https://threadplane.ai';
