/**
 * Default OpenGraph + Twitter share card for the cockpit reference app.
 *
 * Renders a 1200×630 PNG at request time via Next.js ImageResponse.
 * Per-route overrides can be added by dropping an `opengraph-image.tsx`
 * file in any route folder (e.g. per-product or per-topic cards).
 *
 * Cockpit's chrome is Linear-style devtools (Phase 8 spec) — Inter Bold
 * for the headline rather than the marketing site's EB Garamond, so we
 * don't need to bundle a serif TTF.
 */
import { ImageResponse } from 'next/og';
import { darkOverrides } from '@ngaf/design-tokens';

export const runtime = 'edge';
export const alt = 'Cockpit — the live reference app for Agent UI for Angular';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } },
    ).then((res) => res.text());
    const match = css.match(/src:\s*url\((https?:\/\/[^)]+)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const [interRegular, interBold, monoBold] = await Promise.all([
    loadFont('Inter', 400),
    loadFont('Inter', 600),
    loadFont('JetBrains+Mono', 700),
  ]);
  const fonts = [
    interRegular && { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
    interBold && { name: 'Inter', data: interBold, weight: 700 as const, style: 'normal' as const },
    monoBold && { name: 'JetBrains Mono', data: monoBold, weight: 700 as const, style: 'normal' as const },
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: darkOverrides.canvas,
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px',
          color: darkOverrides.textPrimary,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 16,
            letterSpacing: '0.12em',
            color: darkOverrides.accent,
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          Cockpit · Agent UI for Angular
        </div>

        {/* Headline — Inter Bold (cockpit chrome is sans-serif Linear-style) */}
        <div
          style={{
            fontSize: 68,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: darkOverrides.textPrimary,
            marginBottom: 22,
            maxWidth: 1000,
          }}
        >
          The live reference app for the framework.
        </div>

        {/* Subhead */}
        <div
          style={{
            fontSize: 24,
            lineHeight: 1.5,
            color: darkOverrides.textSecondary,
            maxWidth: 940,
            marginBottom: 'auto',
          }}
        >
          Real LangGraph and AG-UI agents running through the same Angular surface you&apos;ll ship.
          Switch between Run · Code · Docs · API for each capability.
        </div>

        {/* Mode pills + cockpit wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 32,
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            {['Run', 'Code', 'Docs', 'API'].map((mode, i) => (
              <ModePill key={mode} active={i === 0}>{mode}</ModePill>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 18,
              fontWeight: 700,
              color: darkOverrides.textPrimary,
            }}
          >
            <span style={{ fontSize: 26 }}>🛩️</span>
            <span>cockpit.threadplane.ai</span>
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

interface ModePillProps {
  active: boolean;
  children: React.ReactNode;
}

/** Mimics the cockpit mode-switcher: rounded pill, accent on the active one. */
function ModePill({ active, children }: ModePillProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 20px',
        borderRadius: 999,
        background: active ? darkOverrides.accent : darkOverrides.surface,
        border: `1px solid ${active ? darkOverrides.accent : darkOverrides.border}`,
        color: active ? darkOverrides.textInverted : darkOverrides.textSecondary,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}
