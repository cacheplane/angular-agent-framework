// SPDX-License-Identifier: MIT
//
// Palette + wordmark lifted verbatim from apps/website/src/app/opengraph-image.tsx
// so marketing cards and the site share one visual language. The plane logo is
// NOT here — it's the bundled brand/plane.png, loaded via logo.ts.
export const brand = {
  gradient: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
  ink: '#1a1a2e',
  inkSoft: '#555770',
  accent: '#004090',
  angular: '#DD0031',
  wordmark: 'cacheplane.ai',
  serif: 'EB Garamond, Georgia, serif',
  sans: 'Inter, sans-serif',
  defaultEyebrow: 'Agent UI for Angular · MIT',
} as const;
