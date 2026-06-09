'use client';
import { useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Button } from '../ui/Button';
import { DemoCtaPair } from './DemoCtaPair';
import { DEMOS } from '../../lib/demos';

type TabKey = (typeof DEMOS)[number]['key'];

interface DemoMedia {
  key: TabKey;
  tabLabel: string;
  url: string;
  videoMp4: string;
  videoWebm: string;
  poster: string;
  href: string;
}

// Demo media is hosted on Vercel Blob (store: ngaf-website-assets) rather than
// committed to the repo — these clips are large binaries that would bloat git
// history on every recut. Re-uploading with the same pathnames keeps these URLs
// stable. See apps/website/scripts/upload-demo-media.md for the upload steps.
const DEMO_CDN = 'https://elgkdaxpsvqcrns1.public.blob.vercel-storage.com/demo';

const MEDIA: DemoMedia[] = [
  { key: 'langgraph', tabLabel: 'LangGraph', url: 'demo.threadplane.ai', videoMp4: `${DEMO_CDN}/langgraph-demo.mp4`, videoWebm: `${DEMO_CDN}/langgraph-demo.webm`, poster: `${DEMO_CDN}/langgraph-demo-poster.webp`, href: DEMOS.find((d) => d.key === 'langgraph')!.href },
  { key: 'ag-ui', tabLabel: 'AG-UI', url: 'ag-ui.threadplane.ai', videoMp4: `${DEMO_CDN}/ag-ui-demo.mp4`, videoWebm: `${DEMO_CDN}/ag-ui-demo.webm`, poster: `${DEMO_CDN}/ag-ui-demo-poster.webp`, href: DEMOS.find((d) => d.key === 'ag-ui')!.href },
];

export function DemoShowcase() {
  const [active, setActive] = useState<TabKey>('langgraph');
  const [launched, setLaunched] = useState<Set<TabKey>>(new Set());
  const media = MEDIA.find((m) => m.key === active)!;
  const isLaunched = launched.has(active);
  const launch = () => setLaunched((prev) => new Set(prev).add(active));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontFamily: tokens.typography.fontMono, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.accent, margin: 0 }}>See it running</p>
      <h2 style={{ fontFamily: tokens.typography.h2.family, fontSize: tokens.typography.h2.size, lineHeight: tokens.typography.h2.line, fontWeight: 700, color: tokens.colors.textPrimary, margin: '10px 0 8px', letterSpacing: '-0.015em' }}>
        One chat UI. Two runtimes. Same code.
      </h2>
      <p style={{ fontFamily: tokens.typography.bodyLg.family, fontSize: tokens.typography.bodyLg.size, lineHeight: tokens.typography.bodyLg.line, color: tokens.colors.textSecondary, maxWidth: 560, margin: '0 auto 20px' }}>
        The identical Threadplane chat surface, running live against a LangGraph backend and an AG-UI backend. Switch tabs to compare — the front end never changes.
      </p>

      <div role="tablist" aria-label="Demo backend" style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
        {MEDIA.map((m) => {
          const on = m.key === active;
          return (
            <button key={m.key} role="tab" aria-selected={on} onClick={() => setActive(m.key)}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: on ? tokens.colors.accent : tokens.colors.accentSurface, color: on ? tokens.colors.textInverted : tokens.colors.textMuted }}>
              {m.tabLabel}
            </button>
          );
        })}
      </div>

      <BrowserFrame url={media.url} elevation="lg">
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#15161f' }}>
          {isLaunched ? (
            <iframe src={media.href} title={`${media.tabLabel} live demo`} loading="lazy"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
          ) : (
            <>
              <video key={media.key} autoPlay muted loop playsInline poster={media.poster}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}>
                <source src={media.videoWebm} type="video/webm" />
                <source src={media.videoMp4} type="video/mp4" />
              </video>
              <button onClick={launch} aria-label={`Launch ${media.tabLabel} live demo`}
                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: 'linear-gradient(180deg, rgba(16,18,32,.15), rgba(16,18,32,.45))', border: 'none', cursor: 'pointer' }}>
                <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15161f', fontSize: 22 }}>&#9654;</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#fff', background: 'rgba(0,0,0,.5)', padding: '8px 14px', borderRadius: 8 }}>Launch live demo</span>
              </button>
            </>
          )}
        </div>
      </BrowserFrame>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        <DemoCtaPair surface="home_demo" size="lg" />
        <Button variant="ghost" size="lg" href="https://cockpit.threadplane.ai" target="_blank" rel="noopener noreferrer">
          See each feature in action →
        </Button>
      </div>
      <p style={{ fontFamily: tokens.typography.caption.family, fontSize: tokens.typography.caption.size, color: tokens.colors.textMuted, margin: '14px 0 0' }}>
        Video loops instantly · click Launch to open the live, interactive demo · MIT · no signup
      </p>
    </div>
  );
}
