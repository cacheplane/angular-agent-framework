/**
 * Default OpenGraph + Twitter share card for the marketing site.
 *
 * Renders a 1200×630 PNG at request time via Next.js ImageResponse.
 * Per-route overrides can be added by dropping an `opengraph-image.tsx`
 * file in any route folder.
 */
import { ImageResponse } from 'next/og';
import { HERO_H1, POSITIONING_PROOF_POINTS, PRIMARY_TAGLINE, SHORT_POSITIONING_DESCRIPTION } from '../lib/positioning';
import { loadCardFonts } from './og-font';

// Node runtime (not edge) so we can read the bundled Garamond TTF off disk.
// Font loading lives in ./og-font so the TTF stays statically traceable.
export const runtime = 'nodejs';
export const alt = PRIMARY_TAGLINE;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const fonts = await loadCardFonts({ mono: true });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 80px',
          color: '#1a1a2e',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 18,
            letterSpacing: '0.12em',
            color: '#004090',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          Threadplane · MIT
        </div>

        {/* Headline — EB Garamond serif matches marketing-site h1 */}
        <div
          style={{
            fontFamily: 'EB Garamond, Georgia, serif',
            fontSize: 76,
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#1a1a2e',
            marginBottom: 24,
            maxWidth: 980,
          }}
        >
          {HERO_H1}
        </div>

        {/* Subhead */}
        <div
          style={{
            fontSize: 26,
            lineHeight: 1.45,
            color: '#555770',
            maxWidth: 920,
            marginBottom: 'auto',
          }}
        >
          {SHORT_POSITIONING_DESCRIPTION}
        </div>

        {/* Footer row — pill trust signals + wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 36,
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            {POSITIONING_PROOF_POINTS.slice(0, 3).map((proofPoint, index) => (
              <PillBadge key={proofPoint.label} tone={index === 0 ? 'accent' : 'neutral'}>
                {proofPoint.label}
              </PillBadge>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'EB Garamond, Georgia, serif',
              fontSize: 22,
              fontWeight: 700,
              color: '#1a1a2e',
            }}
          >
            <span style={{ fontSize: 28 }}>🛩️</span>
            <span>threadplane.ai</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}

interface PillBadgeProps {
  tone: 'accent' | 'neutral';
  children: React.ReactNode;
}

function PillBadge({ tone, children }: PillBadgeProps) {
  const styles = {
    accent: {
      bg: 'rgba(0, 64, 144, 0.08)',
      border: 'rgba(0, 64, 144, 0.18)',
      color: '#004090',
    },
    neutral: {
      bg: '#ffffff',
      border: '#e6e8ee',
      color: '#555770',
    },
  }[tone];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 18px',
        borderRadius: 999,
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
