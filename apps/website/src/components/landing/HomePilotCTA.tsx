'use client';

import { tokens } from '../../../lib/design-tokens';
import { CitationBadge } from './CitationBadge';

const citation77 = {
  source: 'McKinsey — State of AI 2024',
  url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai',
  stat: 'Most companies remain in experimentation or pilot phases',
  note: 'Workflow redesign and human validation are what drive real production value.',
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
          Most Angular teams are 77%<CitationBadge citation={citation77} /> of the way there. Our structured 3-month co-pilot engagement closes the gap.
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
