# Narrative Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new landing page sections (ProblemSection, FullStackSection, ChatFeaturesSection, FairComparisonSection) and one minor copy update (FeatureStrip) to reframe the site around the last-mile production narrative.

**Architecture:** Each section is a standalone `'use client'` React component in `apps/website/src/components/landing/`. They use Framer Motion with `whileInView + viewport={{ once: true }}` for scroll-triggered entrance, `@cacheplane/design-tokens` for all colors and glass values, and inline SVG for particle animations. No new dependencies. `page.tsx` is updated to insert sections in a specific order.

**Tech Stack:** Next.js 16, React 19, TypeScript, Framer Motion (already installed), `@cacheplane/design-tokens` (workspace package)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/website/src/components/landing/ProblemSection.tsx` | 3 stat cards + animated gap progress bar |
| Create | `apps/website/src/components/landing/FullStackSection.tsx` | Vertical stack diagram with SVG particle connectors + roadmap strip |
| Create | `apps/website/src/components/landing/ChatFeaturesSection.tsx` | 4-tab interactive chat scenarios |
| Create | `apps/website/src/components/landing/FairComparisonSection.tsx` | Static comparison table |
| Modify | `apps/website/src/components/landing/FeatureStrip.tsx` | Replace one feature entry copy |
| Modify | `apps/website/src/app/page.tsx` | Insert new sections in correct order |

---

### Task 1: ProblemSection — stat cards and gap animation

**Files:**
- Create: `apps/website/src/components/landing/ProblemSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const STATS = [
  { num: '66%', label: 'of AI solutions are almost right — not quite production-ready' },
  { num: '31%', label: 'of prioritized AI use cases actually reach production' },
  { num: '75%', label: 'of developers still want a human in the loop when trust breaks down' },
];

function useCounter(target: number, duration: number, running: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, target, duration]);
  return value;
}

type Phase = 'idle' | 'filling' | 'stall' | 'closing' | 'done';

export function ProblemSection() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(triggerRef, { once: true, amount: 0.3 });
  const [phase, setPhase] = useState<Phase>('idle');
  const [fillWidth, setFillWidth] = useState('0%');
  const [fillGradient, setFillGradient] = useState(
    `linear-gradient(90deg, rgba(221,0,49,.6), rgba(221,0,49,.4))`
  );
  const [fillTransition, setFillTransition] = useState('none');
  const counterRunning77 = phase === 'filling';
  const counterRunning100 = phase === 'closing' || phase === 'done';
  const count77 = useCounter(77, 1700, counterRunning77);
  const count100 = useCounter(23, 1000, counterRunning100);
  const displayCount = phase === 'done' ? 100 : phase === 'closing' ? 77 + count100 : count77;

  const runAnimation = useCallback(() => {
    if (phase !== 'idle') return;
    // Phase 1: fill to 77%
    setTimeout(() => {
      setFillTransition('width 1.7s cubic-bezier(.4,0,.2,1)');
      setFillWidth('77%');
      setPhase('filling');
    }, 150);
    // Phase 2: stall
    setTimeout(() => setPhase('stall'), 2100);
    // Phase 3: close gap
    setTimeout(() => {
      setFillTransition('width 1s cubic-bezier(.4,0,.2,1)');
      setFillGradient(
        'linear-gradient(90deg, rgba(221,0,49,.5) 0%, rgba(221,0,49,.38) 70%, rgba(0,64,144,.8) 82%, #004090 100%)'
      );
      setFillWidth('100%');
      setPhase('closing');
    }, 3200);
    // Phase 4: done
    setTimeout(() => setPhase('done'), 4400);
  }, [phase]);

  useEffect(() => {
    if (inView) runAnimation();
  }, [inView, runAnimation]);

  const showStall = phase === 'stall';
  const showBadge = phase === 'closing' || phase === 'done';
  const showEnd = phase === 'done';

  return (
    <section style={{ padding: '80px 32px' }}>
      {/* Eyebrow + headline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.angularRed,
          marginBottom: 14,
        }}>
          The Last Mile Problem
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontSize: 'clamp(26px, 3.5vw, 46px)',
          fontWeight: 800,
          lineHeight: 1.1,
          color: tokens.colors.textPrimary,
          marginBottom: 10,
        }}>
          Most AI projects get close.<br />
          <span style={{ color: tokens.colors.angularRed }}>Almost none ship.</span>
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          color: tokens.colors.textSecondary,
          maxWidth: 560,
          margin: '0 auto',
        }}>
          The issue is not generating a demo. It is shipping a trustworthy product.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        maxWidth: 840,
        margin: '0 auto 36px',
      }}>
        {STATS.map((s, i) => (
          <motion.div
            key={s.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              padding: '28px 20px',
              textAlign: 'center',
              borderRadius: 18,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
            }}
          >
            <div style={{
              fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
              fontSize: '3.4rem',
              fontWeight: 800,
              lineHeight: 1,
              marginBottom: 10,
              background: `linear-gradient(135deg, #c00, ${tokens.colors.angularRed})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>{s.num}</div>
            <p style={{ fontSize: '0.82rem', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Gap animation */}
      <motion.div
        ref={triggerRef}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4, duration: 0.5 }}
        style={{
          maxWidth: 840,
          margin: '0 auto',
          padding: '36px 44px',
          borderRadius: 20,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
        }}
      >
        {/* Labels row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#aaa' }}>
            Project kickoff
          </span>
          <span style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: tokens.colors.angularRed,
            opacity: showStall ? 1 : 0,
            transition: 'opacity 0.4s',
          }}>
            ⚠ Teams stall here
          </span>
          <span style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: tokens.colors.accent,
            opacity: showEnd ? 1 : 0,
            transition: 'opacity 0.4s',
          }}>
            ✓ Production
          </span>
        </div>

        {/* Track — overflow:hidden clips fill at container boundary, no border-radius artifact */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{
            height: 16,
            borderRadius: 8,
            background: 'rgba(0,0,0,0.07)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              left: 0, top: 0,
              height: '100%',
              width: fillWidth,
              background: fillGradient,
              transition: fillTransition,
            }} />
            {/* Hatch overlay (gap zone) */}
            <div style={{
              position: 'absolute',
              left: '77%', top: 0,
              width: '23%', height: '100%',
              overflow: 'hidden',
              opacity: showStall ? 1 : 0,
              transition: 'opacity 0.4s',
              pointerEvents: 'none',
            }}>
              <svg width="100%" height="100%" viewBox="0 0 100 16" preserveAspectRatio="none">
                <defs>
                  <pattern id="gap-hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(221,0,49,.18)" strokeWidth="4" />
                  </pattern>
                </defs>
                <rect width="100" height="16" fill="url(#gap-hatch)" />
              </svg>
            </div>
          </div>
          {/* Stall pin — outside the overflow:hidden track */}
          <div style={{
            position: 'absolute',
            left: '77%',
            top: -8,
            transform: 'translateX(-50%)',
            opacity: showStall ? 1 : 0,
            transition: 'opacity 0.4s',
            pointerEvents: 'none',
            textAlign: 'center',
          }}>
            <div style={{ width: 2, height: 34, background: tokens.colors.angularRed, margin: '0 auto', borderRadius: 1 }} />
            <div style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.6rem', color: tokens.colors.angularRed, whiteSpace: 'nowrap', marginTop: 3, fontWeight: 700 }}>
              77%
            </div>
          </div>
        </div>

        {/* Counter row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.78rem', fontWeight: 700,
            color: showEnd ? tokens.colors.accent : tokens.colors.angularRed,
            transition: 'color 0.4s',
            minWidth: 40,
          }}>
            {displayCount}%
          </span>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `rgba(0,64,144,0.08)`,
            border: `1px solid rgba(0,64,144,0.2)`,
            borderRadius: 20,
            padding: '4px 14px',
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.68rem',
            color: tokens.colors.accent,
            fontWeight: 700,
            opacity: showBadge ? 1 : 0,
            transform: showBadge ? 'scale(1)' : 'scale(0.9)',
            transition: 'opacity 0.4s, transform 0.4s',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.colors.accent, display: 'inline-block', animation: 'sr-pulse 1.2s ease-in-out infinite' }} />
            StreamResource closes the gap
          </div>
          <span style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.78rem', fontWeight: 700,
            color: tokens.colors.accent,
            opacity: showEnd ? 1 : 0,
            transition: 'opacity 0.4s',
            minWidth: 40,
            textAlign: 'right',
          }}>
            100%
          </span>
        </div>

        {/* Tagline */}
        <p style={{
          textAlign: 'center',
          marginTop: 20,
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontStyle: 'italic',
          fontSize: '1rem',
          color: tokens.colors.textSecondary,
          opacity: showEnd ? 1 : 0,
          transition: 'opacity 0.6s',
        }}>
          Your backend agent may already work. The frontend and production path is what slips the schedule.
        </p>
      </motion.div>

      <style>{`
        @keyframes sr-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.6)} }
      `}</style>
    </section>
  );
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

Expected: build completes, no TypeScript errors

- [ ] **Step 3: Start dev server and visually verify**

```bash
cd apps/website && ../../node_modules/.bin/next dev
```

Open http://localhost:3000 — temporarily add `<ProblemSection />` to page.tsx to confirm:
1. Three stat cards appear with staggered entrance
2. Gap bar fills red to 77%, stalls with marker, closes blue to 100%
3. "StreamResource closes the gap" badge appears mid-animation
4. Tagline fades in at the end

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/ProblemSection.tsx
git commit -m "feat: add ProblemSection with animated gap progress bar"
```

---

### Task 2: FullStackSection — stack diagram with SVG particle connectors

**Files:**
- Create: `apps/website/src/components/landing/FullStackSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const LAYERS = [
  {
    id: 'sr',
    tag: 'Primitives',
    pkg: '@cacheplane/stream-resource',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    bg: 'rgba(0,64,144,0.05)',
    border: 'rgba(0,64,144,0.25)',
    chips: ['streamResource()', 'messages()', 'interrupt()', 'time travel', 'MockStreamTransport'],
    connLabel: 'AIMessage stream',
    connColor: 'rgba(0,64,144,.22)',
    connFill: '#004090',
    connDur: '1.1',
    connOffset: '0.55',
    pathId: 'path-sr',
  },
  {
    id: 'chat',
    tag: 'UI Layer',
    pkg: '@cacheplane/chat',
    color: '#5a00c8',
    rgb: '90,0,200',
    bg: 'rgba(90,0,200,0.05)',
    border: 'rgba(90,0,200,0.25)',
    chips: ['<chat-messages>', '<chat-interrupt>', '<chat-tool-calls>', '<chat> prebuilt', '<chat-debug>'],
    connLabel: 'Signal<Message[]>',
    connColor: 'rgba(26,122,64,.22)',
    connFill: '#1a7a40',
    connDur: '1.3',
    connOffset: '0.65',
    pathId: 'path-chat',
  },
  {
    id: 'render',
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: '#1a7a40',
    rgb: '26,122,64',
    bg: 'rgba(26,122,64,0.05)',
    border: 'rgba(26,122,64,0.25)',
    chips: ['<render-spec>', 'defineAngularRegistry()', 'signalStateStore()', 'JSON patch streaming'],
    connLabel: 'Spec · JSON patch',
    connColor: '',
    connFill: '',
    connDur: '',
    connOffset: '',
    pathId: '',
  },
];

const NOW_ITEMS = [
  'Text streaming', 'Tool-call cards', 'Interrupt flows',
  'Generative UI specs', 'Thread persistence', 'Deterministic testing',
];
const SOON_ITEMS = ['File attachments', 'Image inputs & rendering', 'Audio input', 'Multi-modal messages'];
const HORIZON_ITEMS = ['Voice UI primitives', 'Video stream rendering', 'Collaborative agents'];

function Connector({ layer }: { layer: typeof LAYERS[0] }) {
  if (!layer.connFill) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 52 }}>
      <svg width="4" height="52" viewBox="0 0 4 52" overflow="visible">
        <line x1="2" y1="0" x2="2" y2="52" stroke={layer.connColor} strokeWidth="2" strokeDasharray="3 3" />
        <circle r="3.5" fill={layer.connFill}>
          <animateMotion dur={`${layer.connDur}s`} repeatCount="indefinite" begin="0s">
            <mpath href={`#${layer.pathId}`} />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" dur={`${layer.connDur}s`} repeatCount="indefinite" begin="0s" />
        </circle>
        <circle r="3.5" fill={layer.connFill}>
          <animateMotion dur={`${layer.connDur}s`} repeatCount="indefinite" begin={`${layer.connOffset}s`}>
            <mpath href={`#${layer.pathId}`} />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" dur={`${layer.connDur}s`} repeatCount="indefinite" begin={`${layer.connOffset}s`} />
        </circle>
        <path id={layer.pathId} d="M2,0 L2,52" style={{ display: 'none' }} />
      </svg>
      <span style={{
        position: 'absolute',
        left: 'calc(50% + 10px)',
        fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
        fontSize: '0.56rem',
        color: '#aaa',
        whiteSpace: 'nowrap',
        top: '50%',
        transform: 'translateY(-50%)',
      }}>
        {layer.connLabel}
      </span>
    </div>
  );
}

export function FullStackSection() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          The Complete Angular Agent Stack
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary, marginBottom: 10,
        }}>
          Three packages. One architecture.<br />
          <span style={{ color: tokens.colors.accent }}>Nothing left to wire yourself.</span>
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary,
          maxWidth: 520, margin: '0 auto',
        }}>
          LangGraph signals flow top to bottom through each layer — primitives to UI to generative components.
        </p>
      </motion.div>

      {/* Stack diagram */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* LangGraph source */}
        <div style={{
          alignSelf: 'center', width: 220,
          background: '#1a1b26', borderRadius: 14, padding: '13px 18px', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.58rem', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            LangGraph Cloud
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(76,175,80,.1)', border: '1px solid rgba(76,175,80,.2)', borderRadius: 6, padding: '3px 10px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4caf50', display: 'inline-block', animation: 'sr-pulse 0.9s infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.62rem', color: '#8bc48b', fontWeight: 600 }}>stream active</span>
          </div>
        </div>

        {/* Layers with connectors */}
        {LAYERS.map((layer, i) => (
          <div key={layer.id}>
            <Connector layer={layer} />
            <div style={{
              borderRadius: 14, padding: '18px 20px',
              background: layer.bg, border: `2px solid ${layer.border}`,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -10, left: 16,
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                padding: '2px 9px', borderRadius: 5, color: '#fff', background: layer.color,
              }}>
                {layer.tag}
              </div>
              <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.76rem', fontWeight: 700, color: layer.color, marginBottom: 8 }}>
                {layer.pkg}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {layer.chips.map(chip => (
                  <span key={chip} style={{
                    fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                    fontSize: '0.58rem', padding: '2px 8px', borderRadius: 4,
                    background: `rgba(${layer.rgb},.07)`, color: layer.color, border: `1px solid rgba(${layer.rgb},.15)`,
                  }}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Roadmap strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        style={{
          maxWidth: 800, margin: '40px auto 0',
          padding: '28px 36px',
          borderRadius: 18,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 32,
        }}
      >
        {/* Now */}
        <div>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1a7a40', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: 14 }}>
            Available now
          </p>
          {NOW_ITEMS.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem', color: '#555', marginBottom: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a7a40', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
        {/* Soon */}
        <div>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c47a00', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: 14 }}>
            Coming soon{' '}
            <span style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.58rem', fontWeight: 700, background: 'rgba(196,122,0,.1)', border: '1px solid rgba(196,122,0,.25)', color: '#c47a00', padding: '1px 6px', borderRadius: 4 }}>
              Planned
            </span>
          </p>
          {SOON_ITEMS.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem', color: '#555', marginBottom: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c47a00', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
        {/* Horizon */}
        <div>
          <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#999', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: 14 }}>
            On the horizon
          </p>
          {HORIZON_ITEMS.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.79rem', color: '#888', marginBottom: 9 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ccc', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
      </motion.div>

      <style>{`
        @keyframes sr-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.6)} }
      `}</style>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

Expected: no TypeScript errors

- [ ] **Step 3: Visual verification**

Temporarily add `<FullStackSection />` to page.tsx. Confirm:
1. LangGraph source node is visible at top
2. Three layer cards appear: Primitives (blue), UI Layer (purple), Gen UI (green)
3. SVG particles animate continuously down each connector line
4. Roadmap strip shows three columns below

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/FullStackSection.tsx
git commit -m "feat: add FullStackSection with animated stack diagram and roadmap strip"
```

---

### Task 3: ChatFeaturesSection — interactive 4-tab chat scenarios

**Files:**
- Create: `apps/website/src/components/landing/ChatFeaturesSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

// ── Types ──────────────────────────────────────────────────────────────────
type Callout = { tag: string; body: string; color: string; rgb: string };
type FeatKey = 'stream' | 'genui' | 'tools' | 'interrupt';

interface FeatDef {
  label: string;
  color: string;
  rgb: string;
  badgeText: string;
  left: Callout[];
  right: Callout[];
  question: string;
  run: (ctx: ScenarioCtx) => Promise<void>;
}

interface ScenarioCtx {
  addUser: (text: string) => void;
  addTyping: () => () => void;
  makeAIBubble: () => { bbl: HTMLElement; out: HTMLElement; cur: HTMLElement };
  typeText: (out: HTMLElement, cur: HTMLElement, text: string, ms?: number) => Promise<void>;
  appendToMsgs: (el: HTMLElement) => void;
  scroll: () => void;
  litLeft: (idx: number) => void;
  litRight: (idx: number) => void;
  wait: (ms: number) => Promise<void>;
  token: number;
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Scenarios ──────────────────────────────────────────────────────────────
async function runStream(ctx: ScenarioCtx) {
  const { addUser, addTyping, makeAIBubble, typeText, litLeft, litRight, wait: w, token } = ctx;
  await w(300);
  addUser('Walk me through LangGraph state.');
  litLeft(0);
  await w(800);
  const removeTyping = addTyping();
  litLeft(0);
  await w(1100);
  removeTyping();
  if (ctx.token !== token) return;
  const { out, cur } = makeAIBubble();
  litRight(0);
  await typeText(out, cur,
    'LangGraph structures your agent as a graph of nodes and edges. Each node returns a partial state update. StreamResource connects to that stream and exposes each update as Angular signals — so your template reacts as tokens arrive.',
    30
  );
  if (ctx.token !== token) return;
  cur.style.display = 'none';
}

async function runGenUI(ctx: ScenarioCtx) {
  const { addUser, addTyping, makeAIBubble, typeText, appendToMsgs, litLeft, litRight, scroll, wait: w, token } = ctx;
  await w(300);
  addUser('Show Q4 revenue by region.');
  litLeft(0);
  await w(800);
  const removeTyping = addTyping();
  await w(900);
  removeTyping();
  if (ctx.token !== token) return;
  const { bbl, out, cur } = makeAIBubble();
  await typeText(out, cur, "Here's the live Q4 breakdown —", 36);
  if (ctx.token !== token) return;
  cur.style.display = 'none';
  litRight(0);
  // Gen UI block
  const gui = document.createElement('div');
  gui.style.cssText = 'margin-top:8px;background:rgba(255,255,255,.04);border:1px solid rgba(26,122,64,.25);border-radius:9px;overflow:hidden;animation:sr-fade .28s ease-out';
  gui.innerHTML = `
    <div style="background:rgba(26,122,64,.09);border-bottom:1px solid rgba(26,122,64,.18);padding:4px 9px;display:flex;align-items:center;gap:5px;font-family:'JetBrains Mono',monospace;font-size:.57rem;color:#4caf50;font-weight:700;text-transform:uppercase;letter-spacing:.06em">
      <span style="width:4px;height:4px;border-radius:50%;background:#4caf50;display:inline-block;animation:sr-pulse .9s infinite"></span>
      @cacheplane/render · DataTable
    </div>
    <div id="_gui-body" style="padding:7px 9px"></div>`;
  bbl.appendChild(gui);
  scroll();
  await w(250);
  const body = document.getElementById('_gui-body');
  if (!body) return;
  const rows: [string, string, string][] = [
    ['North America', '$4.2M', 'color:#4caf50'],
    ['Europe', '$3.1M', 'color:#4caf50'],
    ['APAC', '$1.8M', 'color:#ef5350'],
    ['Total', '$9.1M', ''],
  ];
  for (const [l, v, style] of rows) {
    if (ctx.token !== token) return;
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.71rem;animation:sr-fade .28s ease-out';
    r.innerHTML = `<span style="color:rgba(255,255,255,.36)">${l}</span><span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;font-weight:600;color:#c8ccee;${style}">${v}</span>`;
    body.appendChild(r);
    scroll();
    await w(200);
  }
}

async function runTools(ctx: ScenarioCtx) {
  const { addUser, appendToMsgs, makeAIBubble, typeText, litLeft, litRight, scroll, wait: w, token } = ctx;
  await w(300);
  addUser('Find the latest pricing docs.');
  litLeft(0);
  await w(600);
  // Tool card fires BEFORE any AI text — correct LangGraph execution order
  const card = document.createElement('div');
  card.style.cssText = 'margin-left:31px;background:rgba(255,255,255,.025);border:1px solid rgba(0,64,144,.22);border-radius:9px;padding:9px 12px;animation:sr-fade .28s ease-out';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <div style="width:16px;height:16px;border-radius:4px;background:rgba(0,64,144,.15);display:flex;align-items:center;justify-content:center;font-size:.6rem">🔍</div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;color:#6C8EFF;font-weight:700">search_docs</span>
      <span id="_tool-st" style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:.6rem;color:#FFA726">● running</span>
    </div>
    <div id="_ts1" style="display:none;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#777;padding:2px 0 2px 7px;border-left:2px solid rgba(0,64,144,.12);line-height:1.4">▸ query: "pricing documentation"</div>
    <div id="_ts2" style="display:none;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#777;padding:2px 0 2px 7px;border-left:2px solid rgba(0,64,144,.12);line-height:1.4">▸ index: docs · limit: 8</div>
    <div id="_ts3" style="display:none;font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#4caf50;padding:2px 0 2px 7px;border-left:2px solid rgba(76,175,80,.22);line-height:1.4">✓ 3 documents found</div>`;
  appendToMsgs(card);
  litRight(0);
  scroll();
  await w(350);
  for (const id of ['_ts1', '_ts2']) {
    if (ctx.token !== token) return;
    const el = document.getElementById(id); if (el) el.style.display = '';
    await w(400); scroll();
  }
  await w(500);
  if (ctx.token !== token) return;
  const ts3 = document.getElementById('_ts3'); if (ts3) ts3.style.display = '';
  const tst = document.getElementById('_tool-st');
  if (tst) { tst.textContent = '✓ done'; tst.style.color = '#4caf50'; }
  scroll();
  await w(700);
  if (ctx.token !== token) return;
  const { out, cur } = makeAIBubble();
  await typeText(out, cur,
    'Found 3 pricing docs. The most recent is the Enterprise Tier sheet from last quarter — updated volume discount tiers included.',
    33
  );
  if (ctx.token !== token) return;
  cur.style.display = 'none';
}

async function runInterrupt(ctx: ScenarioCtx) {
  const { addUser, addTyping, makeAIBubble, typeText, appendToMsgs, litLeft, litRight, scroll, wait: w, token } = ctx;
  await w(300);
  addUser('Deploy the service to production.');
  litLeft(0);
  await w(800);
  const removeTyping = addTyping();
  await w(900);
  removeTyping();
  if (ctx.token !== token) return;
  const { out, cur } = makeAIBubble();
  await typeText(out, cur, 'Preparing the deployment — ', 38);
  if (ctx.token !== token) return;
  cur.style.display = 'none';
  await w(300);
  litRight(0);
  const panel = document.createElement('div');
  panel.style.cssText = 'margin:0 0 0 31px;background:rgba(255,160,50,.05);border:1px solid rgba(255,160,50,.2);border-radius:11px;padding:12px 14px;animation:sr-fade .28s ease-out';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:5px;font-size:.76rem;font-weight:600;color:#FFA726;margin-bottom:5px">⚠ Approval required</div>
    <p style="font-size:.72rem;color:rgba(255,255,255,.42);line-height:1.5;margin-bottom:10px">
      Deploy <strong style="color:#FFA726">api-service v2.1.0</strong> to production? This will affect live traffic across all regions.
    </p>
    <div style="display:flex;gap:6px">
      <button style="padding:5px 13px;border-radius:7px;font-size:.71rem;font-weight:600;background:#6C8EFF;color:#fff;border:none;cursor:pointer">Approve</button>
      <button style="padding:5px 13px;border-radius:7px;font-size:.71rem;font-weight:600;background:transparent;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);cursor:pointer">Review first</button>
      <button style="padding:5px 13px;border-radius:7px;font-size:.71rem;font-weight:600;background:rgba(239,83,80,.1);border:1px solid rgba(239,83,80,.24);color:#ef5350;cursor:pointer">Cancel</button>
    </div>`;
  appendToMsgs(panel);
  scroll();
}

// ── Feature definitions ────────────────────────────────────────────────────
const FEATURES: Record<FeatKey, FeatDef> = {
  stream: {
    label: 'Streaming', color: '#6C8EFF', rgb: '108,142,255', badgeText: 'chat-messages',
    left:  [{ tag: '<chat-messages>', body: 'Token-by-token rendering with live cursor. Signals-native, fully OnPush.', color: '#6C8EFF', rgb: '108,142,255' }],
    right: [{ tag: 'isStreaming()', body: 'Reactive signal — true while tokens arrive. Drive spinners and disable inputs without polling.', color: '#6C8EFF', rgb: '108,142,255' }],
    question: 'Walk me through LangGraph state.', run: runStream,
  },
  genui: {
    label: 'Generative UI', color: '#1a7a40', rgb: '26,122,64', badgeText: 'chat-generative-ui',
    left:  [{ tag: '<chat-generative-ui>', body: 'Intercepts onCustomEvent from the agent stream. Wraps <render-spec> and your component registry.', color: '#1a7a40', rgb: '26,122,64' }],
    right: [{ tag: '<render-spec>', body: 'Resolves your Angular component by name, passes props as signals, streams JSON patch updates.', color: '#1a7a40', rgb: '26,122,64' }],
    question: 'Show Q4 revenue by region.', run: runGenUI,
  },
  tools: {
    label: 'Tool Calls', color: tokens.colors.accent, rgb: '0,64,144', badgeText: 'chat-tool-call-card',
    left:  [{ tag: '<chat-tool-calls>', body: 'Headless wrapper exposing tool execution state as signals. Compose your own tool UI.', color: tokens.colors.accent, rgb: '0,64,144' }],
    right: [{ tag: '<chat-tool-call-card>', body: 'Prebuilt card with expandable steps, live progress rows, and collapsible result state.', color: tokens.colors.accent, rgb: '0,64,144' }],
    question: 'Find the latest pricing docs.', run: runTools,
  },
  interrupt: {
    label: 'Interrupt', color: '#FFA726', rgb: '255,167,38', badgeText: 'chat-interrupt-panel',
    left:  [{ tag: '<chat-interrupt>', body: 'Headless interrupt state. Exposes interrupt() signal — bring your own approval UI.', color: '#FFA726', rgb: '255,167,38' }],
    right: [{ tag: '<chat-interrupt-panel>', body: 'Prebuilt approval card. Wired to LangGraph interrupt resume — approve, edit, or cancel.', color: '#FFA726', rgb: '255,167,38' }],
    question: 'Deploy the service to production.', run: runInterrupt,
  },
};

// ── Component ──────────────────────────────────────────────────────────────
export function ChatFeaturesSection() {
  const [activeFeat, setActiveFeat] = useState<FeatKey>('stream');
  const tokenRef = useRef(0);
  const msgsRef = useRef<HTMLDivElement>(null);

  const buildCtx = useCallback((token: number): ScenarioCtx => {
    const msgs = msgsRef.current!;
    const scroll = () => { msgs.scrollTop = msgs.scrollHeight; };

    const addUser = (text: string) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:7px;align-items:flex-start;flex-direction:row-reverse;animation:sr-fade .28s ease-out';
      row.innerHTML = `
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.07);color:rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;flex-shrink:0;margin-top:2px">U</div>
        <div style="padding:8px 12px;font-size:.78rem;line-height:1.55;max-width:270px;background:rgba(108,142,255,.14);border:1px solid rgba(108,142,255,.18);color:#dde0ff;border-radius:13px 4px 13px 13px">${text}</div>`;
      msgs.appendChild(row); scroll();
    };

    const addTyping = () => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:7px;animation:sr-fade .28s ease-out';
      row.innerHTML = `
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(108,142,255,.18);color:#6C8EFF;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;flex-shrink:0;margin-top:2px">AI</div>
        <div style="display:flex;gap:4px;padding:7px 11px;background:rgba(108,142,255,.07);border-radius:12px">
          <span style="width:5px;height:5px;border-radius:50%;background:#6C8EFF;display:inline-block;animation:sr-bounce 1.2s ease-in-out infinite"></span>
          <span style="width:5px;height:5px;border-radius:50%;background:#6C8EFF;display:inline-block;animation:sr-bounce 1.2s ease-in-out .2s infinite"></span>
          <span style="width:5px;height:5px;border-radius:50%;background:#6C8EFF;display:inline-block;animation:sr-bounce 1.2s ease-in-out .4s infinite"></span>
        </div>`;
      msgs.appendChild(row); scroll();
      return () => row.remove();
    };

    const makeAIBubble = () => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:7px;align-items:flex-start;animation:sr-fade .28s ease-out';
      const av = document.createElement('div');
      av.style.cssText = 'width:24px;height:24px;border-radius:50%;background:rgba(108,142,255,.18);color:#6C8EFF;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:700;flex-shrink:0;margin-top:2px';
      av.textContent = 'AI';
      const bbl = document.createElement('div');
      bbl.style.cssText = 'padding:8px 12px;font-size:.78rem;line-height:1.55;max-width:270px;background:rgba(108,142,255,.1);border:1px solid rgba(108,142,255,.13);color:#c8ccee;border-radius:4px 13px 13px 13px';
      const out = document.createElement('span');
      const cur = document.createElement('span');
      cur.style.cssText = 'display:inline-block;width:2px;height:.8em;background:#6C8EFF;vertical-align:text-bottom;margin-left:1px;border-radius:1px;animation:sr-blink .85s step-end infinite';
      bbl.appendChild(out); bbl.appendChild(cur);
      row.appendChild(av); row.appendChild(bbl);
      msgs.appendChild(row); scroll();
      return { bbl, out, cur } as unknown as { bbl: HTMLElement; out: HTMLElement; cur: HTMLElement };
    };

    const typeText = async (out: HTMLElement, cur: HTMLElement, text: string, ms = 34) => {
      for (const ch of text) {
        if (tokenRef.current !== token) return;
        const s = document.createElement('span'); s.textContent = ch;
        out.parentNode!.insertBefore(s, cur);
        scroll();
        await wait(ms);
      }
    };

    const appendToMsgs = (el: HTMLElement) => { msgs.appendChild(el); scroll(); };

    const litLeft = (idx: number) => {
      const items = document.querySelectorAll('#feat-left .feat-co');
      if (items[idx]) items[idx].classList.add('feat-co-lit');
    };
    const litRight = (idx: number) => {
      const items = document.querySelectorAll('#feat-right .feat-co');
      if (items[idx]) items[idx].classList.add('feat-co-lit');
    };

    return { addUser, addTyping, makeAIBubble, typeText, appendToMsgs, scroll, litLeft, litRight, wait, token };
  }, []);

  const switchFeat = useCallback((key: FeatKey) => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    setActiveFeat(key);
    const msgs = msgsRef.current;
    if (msgs) msgs.innerHTML = '';
    // Clear lit callouts
    document.querySelectorAll('.feat-co-lit').forEach(el => el.classList.remove('feat-co-lit'));
    setTimeout(() => {
      const ctx = buildCtx(token);
      FEATURES[key].run(ctx);
    }, 350);
  }, [buildCtx]);

  // Auto-start streaming scenario on mount
  const startedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use intersection observer to start first scenario when visible
  const handleStart = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setTimeout(() => {
      tokenRef.current += 1;
      const token = tokenRef.current;
      const ctx = buildCtx(token);
      FEATURES['stream'].run(ctx);
    }, 500);
  }, [buildCtx]);

  const feat = FEATURES[activeFeat];

  return (
    <motion.section
      ref={containerRef}
      style={{ padding: '80px 32px' }}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      onAnimationComplete={handleStart}
    >
      {/* Eyebrow + headline */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, color: '#5a00c8', marginBottom: 14 }}>
          @cacheplane/chat
        </p>
        <h2 style={{ fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)', fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1, color: tokens.colors.textPrimary, marginBottom: 10 }}>
          Every agent UI primitive,<br />
          <span style={{ color: '#5a00c8' }}>ready to compose.</span>
        </h2>
        <p style={{ fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)', fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary, maxWidth: 520, margin: '0 auto', marginBottom: 28 }}>
          Click a feature to see the component in action.
        </p>
        {/* Feature tabs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {(Object.keys(FEATURES) as FeatKey[]).map(key => {
            const f = FEATURES[key];
            const isActive = activeFeat === key;
            return (
              <button
                key={key}
                onClick={() => switchFeat(key)}
                style={{
                  padding: '8px 20px', borderRadius: 24,
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                  cursor: 'pointer',
                  border: `1.5px solid rgba(${f.rgb},.3)`,
                  background: isActive ? f.color : 'transparent',
                  color: isActive ? '#fff' : f.color,
                  boxShadow: isActive ? `0 4px 14px rgba(${f.rgb},.28)` : 'none',
                  transition: 'background .2s, color .2s, box-shadow .2s',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px 1fr', gap: '0 20px', maxWidth: 960, margin: '0 auto', alignItems: 'start' }}>

        {/* Left callouts */}
        <div id="feat-left" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feat.left.map((co, i) => (
            <div key={i} className="feat-co" style={{ '--co-color': co.color, '--co-rgb': co.rgb } as React.CSSProperties}>
              <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: co.color, marginBottom: 4 }}>
                {co.tag}
              </p>
              <p style={{ fontSize: '0.76rem', color: tokens.colors.textSecondary, lineHeight: 1.45 }}>{co.body}</p>
            </div>
          ))}
        </div>

        {/* Chat window */}
        <div style={{ background: '#12131f', borderRadius: 18, overflow: 'hidden', boxShadow: '0 0 50px rgba(0,64,144,.1), 0 20px 40px rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column', height: 460 }}>
          {/* Title bar */}
          <div style={{ background: 'rgba(255,255,255,.025)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.67rem', color: 'rgba(255,255,255,.22)' }}>
              angular agent
            </div>
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.58rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.05em',
              background: `rgba(${feat.rgb},.12)`, color: feat.color, border: `1px solid rgba(${feat.rgb},.22)`,
            }}>
              {feat.badgeText}
            </div>
          </div>
          {/* Messages */}
          <div ref={msgsRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 9, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.06) transparent' }} />
          {/* Input bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '9px 11px', display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
            <input
              style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '6px 10px', fontSize: '0.76rem', color: 'rgba(255,255,255,.45)', fontFamily: 'Inter,sans-serif', outline: 'none' }}
              placeholder={feat.question}
              readOnly
            />
            <button style={{ width: 30, height: 30, borderRadius: 8, background: '#6C8EFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            </button>
          </div>
        </div>

        {/* Right callouts */}
        <div id="feat-right" style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feat.right.map((co, i) => (
            <div key={i} className="feat-co" style={{ '--co-color': co.color, '--co-rgb': co.rgb } as React.CSSProperties}>
              <p style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: co.color, marginBottom: 4 }}>
                {co.tag}
              </p>
              <p style={{ fontSize: '0.76rem', color: tokens.colors.textSecondary, lineHeight: 1.45 }}>{co.body}</p>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        .feat-co {
          padding: 12px 15px;
          border-radius: 12px;
          background: rgba(255,255,255,.55);
          border: 1px solid rgba(255,255,255,.7);
          backdrop-filter: blur(8px);
          transition: border-color .3s, box-shadow .3s, background .3s;
        }
        .feat-co-lit {
          background: rgba(255,255,255,.88) !important;
          border-color: var(--co-color) !important;
          box-shadow: 0 0 14px rgba(var(--co-rgb), .12) !important;
        }
        @keyframes sr-fade { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sr-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.6)} }
        @keyframes sr-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes sr-bounce { 0%,80%,100%{transform:scale(.65);opacity:.5} 40%{transform:scale(1);opacity:1} }
      `}</style>
    </motion.section>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

Expected: no TypeScript errors

- [ ] **Step 3: Visual verification**

Add `<ChatFeaturesSection />` to page.tsx temporarily. Confirm:
1. Four tab buttons render: Streaming, Generative UI, Tool Calls, Interrupt
2. Streaming tab: user message → typing → AI tokens stream in
3. Gen UI tab: AI text → DataTable rows stream in inline
4. Tool Calls tab: tool card appears first, steps progress, then AI responds
5. Interrupt tab: AI starts sentence → pauses → approval panel appears
6. Callout cards light up on correct step in each scenario
7. Switching tabs clears the chat and starts the new scenario

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/ChatFeaturesSection.tsx
git commit -m "feat: add ChatFeaturesSection with 4 interactive chat scenarios"
```

---

### Task 4: FairComparisonSection — static comparison table

**Files:**
- Create: `apps/website/src/components/landing/FairComparisonSection.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const ROWS = [
  {
    capability: 'Token streaming',
    without: 'Custom SSE wiring + zone management',
    with: 'streamResource() signal, zero boilerplate',
  },
  {
    capability: 'Thread persistence',
    without: 'Manual localStorage + API calls',
    with: 'threadId signal + onThreadId callback',
  },
  {
    capability: 'Interrupt flows',
    without: 'Custom polling or WebSocket',
    with: 'interrupt() signal + resume built in',
  },
  {
    capability: 'Tool-call rendering',
    without: 'Custom event parsing',
    with: '<chat-tool-call-card> or headless <chat-tool-calls>',
  },
  {
    capability: 'Generative UI',
    without: 'No established pattern',
    with: '<chat-generative-ui> + <render-spec> + registry',
  },
  {
    capability: 'Deterministic testing',
    without: 'Mock HTTP + tick management',
    with: 'MockStreamTransport + writable signals',
  },
  {
    capability: 'Human approval UI',
    without: 'Build from scratch',
    with: '<chat-interrupt-panel>',
  },
  {
    capability: 'Full chat layout',
    without: 'Build from scratch',
    with: '<chat> drop-in',
  },
];

export function FairComparisonSection() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          A fair comparison
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary, marginBottom: 12,
        }}>
          What StreamResource adds
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary,
          maxWidth: 560, margin: '0 auto',
        }}>
          LangChain and LangGraph are excellent. This is what the Angular production layer provides on top.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{
          maxWidth: 860, margin: '0 auto',
          borderRadius: 20,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(255,255,255,.3)',
          borderBottom: `1px solid ${tokens.glass.border}`,
          padding: '14px 24px',
        }}>
          {['Capability', 'LangChain + Angular alone', 'With StreamResource'].map((h, i) => (
            <div key={h} style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: i === 2 ? tokens.colors.accent : tokens.colors.textMuted,
            }}>
              {h}
            </div>
          ))}
        </div>
        {/* Rows */}
        {ROWS.map((row, i) => (
          <motion.div
            key={row.capability}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              padding: '14px 24px',
              borderBottom: i < ROWS.length - 1 ? `1px solid rgba(0,0,0,.05)` : 'none',
              alignItems: 'center',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.72rem', fontWeight: 700, color: tokens.colors.textPrimary,
            }}>
              {row.capability}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.textMuted, paddingRight: 16, lineHeight: 1.5 }}>
              {row.without}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.accent, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#1a7a40', marginTop: 2, flexShrink: 0 }}>✓</span>
              <span style={{ fontFamily: row.with.startsWith('<') ? 'var(--font-mono,"JetBrains Mono",monospace)' : 'inherit', fontSize: row.with.startsWith('<') ? '0.72rem' : '0.8rem' }}>
                {row.with}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

- [ ] **Step 3: Visual verification**

Add `<FairComparisonSection />` to page.tsx. Confirm 8 rows render, "With" column shows ✓ in green with blue text, header row shows "With StreamResource" in accent blue.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/FairComparisonSection.tsx
git commit -m "feat: add FairComparisonSection comparison table"
```

---

### Task 5: Update FeatureStrip copy

**Files:**
- Modify: `apps/website/src/components/landing/FeatureStrip.tsx`

- [ ] **Step 1: Open the file and find the Generative UI entry**

The current `FEATURES` array in `FeatureStrip.tsx` contains entries. Find the entry about "Generative UI" or any entry that implies StreamResource is the only solution for generative UI in Angular. Replace it with:

```tsx
{ icon: '🎨', title: 'Generative UI', desc: 'Agent-emitted Angular components via @cacheplane/render. Your component registry, your design — rendered inline from a JSON spec.' },
```

If no such entry exists, verify by reading the file:

```bash
grep -n "Generative\|generative\|no established" apps/website/src/components/landing/FeatureStrip.tsx
```

If the grep returns nothing, skip to Step 3.

- [ ] **Step 2: Apply the replacement**

Open `apps/website/src/components/landing/FeatureStrip.tsx`. In the `FEATURES` array, if there is a feature with text like "no established pattern" or "no established Angular pattern exists" replace only that feature entry's `desc` field with:

```
'Agent-emitted Angular components via @cacheplane/render. Your component registry, your design — rendered inline from a JSON spec.'
```

Leave all other entries untouched.

- [ ] **Step 3: Build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/FeatureStrip.tsx
git commit -m "fix: update FeatureStrip generative UI copy to remove exclusivity claim"
```

---

### Task 6: Wire all sections into page.tsx

**Files:**
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Add imports**

Add these four imports to `apps/website/src/app/page.tsx` alongside the existing imports:

```tsx
import { ProblemSection } from '../components/landing/ProblemSection';
import { FullStackSection } from '../components/landing/FullStackSection';
import { ChatFeaturesSection } from '../components/landing/ChatFeaturesSection';
import { FairComparisonSection } from '../components/landing/FairComparisonSection';
```

- [ ] **Step 2: Insert sections in correct order**

The full updated section order in the JSX:

```tsx
<HeroTwoCol />
<StatsStrip />
{/* New: problem narrative */}
<ProblemSection />
<FullStackSection />
<ChatFeaturesSection />
{/* Existing */}
<ValueProps />
<CodeBlock />
<LangGraphShowcase />
<DeepAgentsShowcase />
{/* New: comparison */}
<FairComparisonSection />
{/* Existing */}
<ArchDiagram />
<FeatureStrip />
<CockpitCTA />
```

- [ ] **Step 3: Add two more ambient gradient blobs** for the extended page height (new sections add ~2400px of content)

Add after the existing five blobs:

```tsx
<div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 6500, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />
<div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.cool, top: 8000, left: '20%', filter: 'blur(70px)', pointerEvents: 'none' }} />
```

- [ ] **Step 4: Build check**

```bash
cd apps/website && ../../node_modules/.bin/next build --no-lint 2>&1 | tail -20
```

Expected: successful build, no type errors

- [ ] **Step 5: Full visual verification**

```bash
cd apps/website && ../../node_modules/.bin/next dev
```

Open http://localhost:3000. Scroll top to bottom and verify:
1. After StatsStrip: ProblemSection with 3 stat cards + gap animation
2. After ProblemSection: FullStackSection stack with animated particles + roadmap strip
3. After FullStackSection: ChatFeaturesSection with 4 tabs, each scenario runs correctly
4. After DeepAgentsShowcase: FairComparisonSection with 8-row table
5. All existing sections still present and unchanged
6. No console errors

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/app/page.tsx
git commit -m "feat: wire ProblemSection, FullStackSection, ChatFeaturesSection, FairComparisonSection into landing page"
```
