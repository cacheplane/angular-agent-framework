import { GenerativeUIFrame } from './GenerativeUIFrame';
import { CopyPromptButton } from '../docs/CopyPromptButton';
import { tokens } from '@cacheplane/design-tokens';

const SETUP_SNIPPET = 'npm install @cacheplane/angular\n\n// app.config.ts\nprovideAgent({ apiUrl: \'http://localhost:2024\' })';

function LangChainBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(0, 64, 144, 0.08)',
      border: '1px solid rgba(0, 64, 144, 0.2)',
      borderRadius: 20, padding: '4px 10px 4px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: tokens.colors.textPrimary,
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: 3,
        background: 'rgba(0, 64, 144, 0.15)',
        border: '1px solid rgba(0, 64, 144, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, fontWeight: 700, color: tokens.colors.accent, lineHeight: 1,
      }}>LC</span>
      LangChain
    </span>
  );
}

function AngularBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(221, 0, 49, 0.06)',
      border: '1px solid rgba(221, 0, 49, 0.15)',
      borderRadius: 20, padding: '4px 10px 4px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: tokens.colors.textPrimary,
    }}>
      <svg width="14" height="14" viewBox="0 0 250 250" aria-hidden={true}>
        <path fill="#DD0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z"/>
        <path fill="#C3002F" d="M125 30v22.2l-61.7 162.4 37.8 15.4z"/>
        <path fill="#fff" d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9z"/>
      </svg>
      Angular
    </span>
  );
}

export async function HeroTwoCol() {
  return (
    <section className="hero-two-col" aria-labelledby="hero-heading" style={{ position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .hero-two-col {
          display: flex;
          align-items: center;
          padding: 96px 40px 60px;
          gap: 48px;
          min-height: 100vh;
          background: ${tokens.gradient.bgFlow};
        }
        .hero-left { flex: 0 0 55%; max-width: 55%; position: relative; z-index: 1; }
        .hero-right { flex: 0 0 45%; max-width: 45%; display: flex; justify-content: center; position: relative; z-index: 1; }
        @media (max-width: 767px) {
          .hero-two-col { flex-direction: column; padding: 80px 24px 40px; }
          .hero-left { flex: none; max-width: 100%; width: 100%; }
          .hero-right { flex: none; max-width: 100%; width: 100%; max-height: 300px; overflow: hidden; }
        }
      `}</style>

      {/* Ambient gradient blobs */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.warm, top: -150, left: -100, filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 450, height: 450, borderRadius: '50%', background: tokens.gradient.cool, bottom: -100, right: -50, filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: '30%', right: '20%', filter: 'blur(50px)', pointerEvents: 'none' }} />

      {/* Left column */}
      <div className="hero-left">
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          <LangChainBadge />
          <AngularBadge />
        </div>

        <h1 id="hero-heading" style={{
          fontFamily: 'var(--font-garamond)',
          fontSize: 'clamp(36px, 4.5vw, 72px)',
          fontWeight: 800,
          lineHeight: 1.05,
          color: tokens.colors.textPrimary,
          margin: 0,
          marginBottom: 20,
        }}>
          The Enterprise Agent Framework for LangChain and{' '}
          <span style={{ color: tokens.colors.angularRed }}>Angular</span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-garamond)',
          fontStyle: 'italic',
          fontSize: 'clamp(16px, 1.8vw, 20px)',
          color: tokens.colors.textSecondary,
          maxWidth: '44ch',
          lineHeight: 1.5,
          margin: 0,
          marginBottom: 32,
        }}>
          Signal-native streaming for LangGraph &mdash; production patterns your Angular team can own.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <CopyPromptButton prompt={SETUP_SNIPPET} variant="hero" label="Copy setup" />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: tokens.colors.textMuted,
          }}>
            npm install @cacheplane/angular
          </span>
        </div>
      </div>

      {/* Right column */}
      <div className="hero-right">
        <GenerativeUIFrame />
      </div>
    </section>
  );
}
