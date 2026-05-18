/**
 * Default OpenGraph + Twitter share card for the marketing site.
 *
 * Renders a 1200×630 PNG at request time via Next.js ImageResponse.
 * Per-route overrides can be added by dropping an `opengraph-image.tsx`
 * file in any route folder.
 */
import { ImageResponse } from 'next/og';

// Node runtime (not edge) so we can read the bundled Garamond TTF off disk.
export const runtime = 'nodejs';
export const alt = 'Agent UI for Angular — Signal-native streaming for Angular + LangGraph';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    // Modern UA → woff2. Older UA → ttf. We ask for both and pick the first that resolves.
    // ImageResponse wants the raw font binary; woff2 is fine (Satori decompresses internally).
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } },
    ).then((res) => res.text());
    // Grab any url(...) src — the first one is the woff2 the modern UA gets.
    const match = css.match(/src:\s*url\((https?:\/\/[^)]+)\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * EB Garamond is bundled as a static-weight TTF next to this file because:
 * 1. Google Fonts only serves Garamond as woff2 — Satori can't decode woff2.
 * 2. The variable-weight TTF in Google's fonts repo trips Satori's TTF parser
 *    ("Cannot read properties of undefined (reading '256')") on variable-font
 *    tables (fvar/STAT/MVAR/HVAR).
 *
 * The committed TTF was produced by instancing the upstream variable font to
 * wght=700 and stripping the now-unused variable tables — see
 * apps/website/scripts/instance-garamond.py. The file is ~500KB, served only
 * from this server-side render path (never downloaded by browsers).
 */
async function loadLocalGaramond(): Promise<ArrayBuffer | null> {
  try {
    const { fileURLToPath } = await import('node:url');
    const { readFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const buf = await readFile(join(here, 'EBGaramond-Bold.ttf'));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch (err) {
    console.warn('opengraph-image: failed to load local Garamond TTF', err);
    return null;
  }
}

export default async function OpenGraphImage() {
  const [garamondBold, interRegular, interBold, monoBold] = await Promise.all([
    loadLocalGaramond(),
    loadFont('Inter', 400),
    loadFont('Inter', 600),
    loadFont('JetBrains+Mono', 700),
  ]);
  const fonts = [
    garamondBold && { name: 'EB Garamond', data: garamondBold, weight: 700 as const, style: 'normal' as const },
    interRegular && { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
    interBold && { name: 'Inter', data: interBold, weight: 600 as const, style: 'normal' as const },
    monoBold && { name: 'JetBrains Mono', data: monoBold, weight: 700 as const, style: 'normal' as const },
  ].filter((f): f is NonNullable<typeof f> => f !== null);

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
          Agent UI for Angular · MIT
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
          Build fullstack agentic Angular apps.
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
          Build fullstack agentic Angular apps with signal-native streaming,
          runtime adapters, generative UI, and production-ready primitives.
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
            <PillBadge tone="accent">MIT</PillBadge>
            <PillBadge tone="neutral">LangGraph + AG-UI</PillBadge>
            <PillBadge tone="angular">Angular 20+</PillBadge>
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
  tone: 'accent' | 'neutral' | 'angular';
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
    angular: {
      bg: 'rgba(221, 0, 49, 0.06)',
      border: 'rgba(221, 0, 49, 0.18)',
      color: '#DD0031',
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
