// apps/website/src/components/landing/angular/AngularFooterCTA.tsx
'use client';
import { tokens } from '@cacheplane/design-tokens';

export function AngularFooterCTA() {
  return (
    <section style={{ padding: '5rem 2rem' }}>
      <div style={{
        maxWidth: '42rem', margin: '0 auto', textAlign: 'center',
        background: tokens.glass.bg, border: `1px solid ${tokens.colors.accentBorder}`,
        borderRadius: 16, padding: 48,
        backdropFilter: `blur(${tokens.glass.blur})`,
      }}>
        <h2 style={{
          fontFamily: "'EB Garamond', serif", fontSize: 'clamp(24px, 4vw, 32px)',
          fontWeight: 700, color: tokens.colors.textPrimary, marginBottom: 16,
        }}>
          Ready to ship your LangGraph agent?
        </h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 16, lineHeight: 1.7,
          color: tokens.colors.textSecondary, marginBottom: 32,
        }}>
          Download the enterprise guide, explore the docs, or start the pilot program.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/whitepapers/angular.pdf" download
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: tokens.colors.accent, color: '#fff',
              fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', borderRadius: 6,
            }}>
            Download the Guide
          </a>
          <a href="/pilot-to-prod"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: tokens.glass.bg, color: tokens.colors.accent,
              fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', borderRadius: 6,
              border: `1px solid ${tokens.colors.accentBorder}`,
            }}>
            Pilot Program →
          </a>
          <a href="/docs"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: 'transparent', color: tokens.colors.textSecondary,
              fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', borderRadius: 6,
              border: `1px solid ${tokens.glass.border}`,
            }}>
            View Docs
          </a>
        </div>
      </div>
    </section>
  );
}
