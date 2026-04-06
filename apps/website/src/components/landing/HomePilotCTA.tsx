'use client';

import { tokens } from '../../../lib/design-tokens';
import { CitationBadge } from './CitationBadge';

const gartnerCitation = {
  source: 'Gartner — GenAI Project Failure (2026)',
  url: 'https://www.gartner.com/en/articles/genai-project-failure',
  stat: '50% of GenAI projects abandoned after proof of concept by end of 2025',
  note: 'Poor data quality, inadequate risk controls, escalating costs, and unclear business value are the primary causes.',
};

export function HomePilotCTA() {
  return (
    <section style={{ padding: '5rem 2rem' }}>
      <div style={{
        maxWidth: '42rem',
        margin: '0 auto',
        textAlign: 'center',
        background: tokens.glass.bg,
        border: `1px solid ${tokens.colors.accentBorder}`,
        borderRadius: 16,
        padding: '48px',
        backdropFilter: `blur(${tokens.glass.blur})`,
      }}>
        <h2 style={{ fontFamily: "'EB Garamond', serif", fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, color: tokens.colors.textPrimary, marginBottom: 16 }}>
          Ready to ship your agent?
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, lineHeight: 1.7, color: tokens.colors.textSecondary, marginBottom: 32 }}>
          Half of GenAI projects die after proof of concept.<CitationBadge citation={gartnerCitation} /> Yours doesn&apos;t have to. Our structured 3-month co-pilot engagement closes the gap.
        </p>
        <a
          href="/pilot-to-prod"
          style={{
            display: 'inline-block',
            padding: '0.875rem 2rem',
            background: tokens.colors.accent,
            color: '#fff',
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            borderRadius: 6,
          }}
        >
          Explore the Pilot Program →
        </a>
      </div>
    </section>
  );
}
