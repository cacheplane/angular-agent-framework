/**
 * Default OpenGraph + Twitter share card for the marketing site.
 *
 * Renders a 1200×630 PNG at request time via Next.js ImageResponse.
 * Per-route overrides can be added by dropping an `opengraph-image.tsx`
 * file in any route folder.
 *
 * DESIGNED FOR FEED SIZE, NOT FOR THE FULL-SIZE PNG. Timelines render this
 * around 500px wide and Slack unfurls it narrower still, so every size here is
 * chosen against that ~0.42× rendering: the wordmark's 100px lands at 42px,
 * the category line's 52px at 22px, the body's 36px at 15px, the runtime
 * pill's 34px at 14px. Nothing is below 30px source, because ~12px rendered is
 * where text stops being read and starts being texture.
 *
 * That budget is the whole design. The card it replaces spent its legibility
 * on an 18px eyebrow, three 15px pills and a three-line 26px paragraph — all
 * of which dissolved into grey noise at feed scale — and left the product name
 * as the smallest type on the card. Four elements is what fits: who this is,
 * what it is, what you get, and what it plugs into.
 *
 * The stack is centred rather than left-aligned like the site's hero, for one
 * reason: surfaces that show a share image as a square or 4:3 thumbnail
 * centre-crop it, and a left-aligned column loses its first word or two when
 * they do. Centred, the product name survives every crop that keeps the middle.
 *
 * Colours are the production dark-surface tokens resolved to literals, because
 * Satori cannot read CSS variables. Sources:
 *   - apps/website/src/styles/ui.css  `[data-ui="section"][data-surface="dark"]`
 *     (canvas gradient, text ramp, dark-scope accent, accent seam) and
 *     landing.css `.proof-strip::before` (the radial accent glow)
 *   - libs/design-tokens/src/lib/theme.css  (--color-angular-red)
 * If either changes, re-resolve them here.
 */
import { ImageResponse } from 'next/og';
import { HERO_H1_LINES, HERO_SUBHEAD, POSITIONING_PROOF_POINTS, PRIMARY_TAGLINE } from '../lib/positioning';
import { loadCardFonts } from './og-font';

// Node runtime (not edge) so we can read the bundled Garamond TTF off disk.
// Font loading lives in ./og-font so the TTF stays statically traceable.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Dark-surface tokens (ui.css) + brand red (theme.css), resolved for Satori. */
const TOKENS = {
  /** --color-canvas gradient on [data-surface="dark"] */
  canvas: 'linear-gradient(180deg, #161616 0%, #0e0e0e 100%)',
  /** --color-text-primary rgb(245, 245, 245) */
  textPrimary: '#f5f5f5',
  /** --color-text-secondary rgb(200, 200, 200) */
  textSecondary: '#c8c8c8',
  /** --color-text-muted rgb(160, 160, 160) */
  textMuted: '#a0a0a0',
  /** --color-accent in the dark scope (= --color-accent-light) */
  accent: '#64c3fd',
  /** --color-accent-surface rgba(100, 195, 253, 0.08) */
  accentSurface: 'rgba(100, 195, 253, 0.08)',
  /** --color-accent-border rgba(100, 195, 253, 0.2) */
  accentBorder: 'rgba(100, 195, 253, 0.2)',
  /** --color-border-strong rgb(60, 60, 60) */
  borderStrong: '#3c3c3c',
  /** --color-angular-red */
  angularRed: '#DD0031',
} as const;

/**
 * "Threadplane" — taken from the tagline rather than retyped, so the card and
 * the <title> can never disagree about the product name. Falls back to the
 * whole tagline if the em dash ever goes away.
 */
const BRAND_NAME = PRIMARY_TAGLINE.split('—')[0].trim() || PRIMARY_TAGLINE;
/** "LangGraph + AG-UI" — the first proof point is the runtime claim. */
const RUNTIMES = POSITIONING_PROOF_POINTS[0].label;

/** Describes what the card actually says, not just the page it links to. */
export const alt = `${PRIMARY_TAGLINE}. ${HERO_SUBHEAD} Works with ${RUNTIMES}.`;

export default async function OpenGraphImage() {
  const fonts = await loadCardFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: TOKENS.canvas,
          display: 'flex',
          flexDirection: 'column',
          color: TOKENS.textPrimary,
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/*
          The accent glow the homepage's dark proof band rises behind
          (landing.css `.proof-strip::before`), scaled to the card and pooled
          above the wordmark. It gives the flat canvas some depth without
          putting anything on it that has to be read.
        */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: -230,
            right: 190,
            width: 820,
            height: 720,
            background:
              'radial-gradient(circle, rgba(100, 195, 253, 0.15) 0%, rgba(100, 195, 253, 0.05) 55%, rgba(100, 195, 253, 0) 75%)',
          }}
        />

        {/*
          Brand seam. ui.css draws a 1px accent line at every light→dark
          section boundary; at feed scale 1px is invisible, so the card states
          it at 8px and runs it Angular-red → accent-blue. At thumbnail sizes
          where the copy has gone soft it is still a legible brand signal.
        */}
        <div
          style={{
            display: 'flex',
            height: 8,
            background: `linear-gradient(90deg, ${TOKENS.angularRed} 0%, ${TOKENS.angularRed} 24%, ${TOKENS.accent} 46%, ${TOKENS.accent} 100%)`,
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '0 68px',
          }}
        >
          {/* Wordmark. Biggest thing on the card: nobody knows the name yet. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              fontFamily: 'EB Garamond, Georgia, serif',
              fontSize: 100,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-0.015em',
              color: TOKENS.textPrimary,
            }}
          >
            <span style={{ fontSize: 68 }}>🛩️</span>
            <span>{BRAND_NAME}</span>
          </div>

          {/* Category, one line: what the thing is. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 34,
              fontSize: 52,
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
              color: TOKENS.textPrimary,
            }}
          >
            {HERO_H1_LINES.map((line) => (
              <div key={line} style={{ display: 'flex' }}>{line}</div>
            ))}
          </div>

          {/* What you get. Wrapped to two lines on purpose — see the header. */}
          <div
            style={{
              display: 'flex',
              marginTop: 26,
              maxWidth: 800,
              fontSize: 36,
              lineHeight: 1.38,
              color: TOKENS.textSecondary,
            }}
          >
            {HERO_SUBHEAD}
          </div>

          {/* Footer: the runtimes, stated loudly, plus the licence. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              marginTop: 44,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 26px',
                borderRadius: 999,
                background: TOKENS.accentSurface,
                border: `1px solid ${TOKENS.accentBorder}`,
                fontSize: 34,
                fontWeight: 600,
                color: TOKENS.accent,
              }}
            >
              {RUNTIMES}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 26px',
                borderRadius: 999,
                border: `1px solid ${TOKENS.borderStrong}`,
                fontSize: 34,
                fontWeight: 600,
                color: TOKENS.textMuted,
              }}
            >
              MIT · open source
            </div>
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
