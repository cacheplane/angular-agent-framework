'use client';
import { useRef, useEffect, useState, useCallback, useId } from 'react';
import { motion, useInView } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';
import { CitationBadge, type Citation } from './CitationBadge';

const STATS: Array<{ num: string; label: string; citation: Citation }> = [
  {
    num: '66%',
    label: 'of AI solutions are almost right — not quite production-ready',
    citation: {
      source: 'Stack Overflow Developer Survey 2025',
      url: 'https://survey.stackoverflow.co/2025/ai',
      stat: '66% of developers say AI tools are "almost right but not quite"',
      note: 'AI accelerates prototyping but struggles to reach production-quality outcomes.',
    },
  },
  {
    num: '50%',
    label: 'of GenAI projects abandoned after proof of concept',
    citation: {
      source: 'Gartner — GenAI Project Failure (2026)',
      url: 'https://www.gartner.com/en/articles/genai-project-failure',
      stat: '50% of GenAI projects abandoned after proof of concept by end of 2025',
      note: 'Poor data quality, inadequate risk controls, escalating costs, and unclear business value are the primary causes.',
    },
  },
  {
    num: '75%',
    label: 'of developers still want a human in the loop when trust breaks down',
    citation: {
      source: 'Stack Overflow Developer Survey 2025',
      url: 'https://survey.stackoverflow.co/2025/ai',
      stat: '75% of developers prefer human help when AI trust breaks down',
      note: 'Production agents that take consequential actions require human oversight.',
    },
  },
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
  const uid = useId();
  const hatchId = `gap-hatch-${uid.replace(/:/g, '')}`;

  const triggerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(triggerRef, { once: true, amount: 0.3 });
  const [phase, setPhase] = useState<Phase>('idle');
  const [fillWidth, setFillWidth] = useState('0%');
  const [fillGradient, setFillGradient] = useState(
    `linear-gradient(90deg, rgba(221,0,49,.6), rgba(221,0,49,.4))`
  );
  const [fillTransition, setFillTransition] = useState('none');
  const counterRunning50 = phase === 'filling';
  const counterRunning100 = phase === 'closing' || phase === 'done';
  const count50 = useCounter(50, 1700, counterRunning50);
  const count100 = useCounter(50, 1000, counterRunning100);
  // 'done' timeout (4400ms) fires after closing counter finishes (3200 + 1000 = 4200ms)
  // so 50 + count100 always reaches 100 before the phase snaps to literal 100
  const displayCount = phase === 'done' ? 100 : phase === 'closing' ? 50 + count100 : count50;

  const runAnimation = useCallback(() => {
    if (phase !== 'idle') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Phase 1 (150ms): fill to 50% — half of projects reach POC
    timers.push(setTimeout(() => {
      setFillTransition('width 1.7s cubic-bezier(.4,0,.2,1)');
      setFillWidth('50%');
      setPhase('filling');
    }, 150));
    // Phase 2 (2100ms): stall — marker + hatch + shake
    timers.push(setTimeout(() => setPhase('stall'), 2100));
    // Phase 3 (3200ms): close gap to 100%
    timers.push(setTimeout(() => {
      setFillTransition('width 1s cubic-bezier(.4,0,.2,1)');
      setFillGradient(
        'linear-gradient(90deg, rgba(221,0,49,.5) 0%, rgba(221,0,49,.38) 40%, rgba(0,64,144,.8) 60%, #004090 100%)'
      );
      setFillWidth('100%');
      setPhase('closing');
    }, 3200));
    // Phase 4 (4400ms): done — end labels + tagline
    timers.push(setTimeout(() => setPhase('done'), 4400));
    return timers;
  }, [phase]);

  useEffect(() => {
    if (!inView) return;
    const timers = runAnimation();
    return () => timers?.forEach(clearTimeout);
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 10 }}>
              <span style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '3.4rem',
                fontWeight: 800,
                lineHeight: 1,
                background: `linear-gradient(135deg, #c00, ${tokens.colors.angularRed})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{s.num}</span>
              <CitationBadge citation={s.citation} />
            </div>
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
          <span style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: 'max(12px, 0.68rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#aaa' }}
            aria-hidden="true">
            Project kickoff
          </span>
          <span style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: 'max(12px, 0.68rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: tokens.colors.angularRed,
            opacity: showStall ? 1 : 0,
            transition: 'opacity 0.4s',
          }} aria-hidden="true">
            ⚠ Teams stall here
          </span>
          <span style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: 'max(12px, 0.68rem)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: tokens.colors.accent,
            opacity: showEnd ? 1 : 0,
            transition: 'opacity 0.4s',
          }} aria-hidden="true">
            ✓ Production
          </span>
        </div>

        {/* Track — overflow:hidden clips fill at container boundary, no border-radius artifact */}
        <div style={{ position: 'relative', marginBottom: 10 }} role="progressbar" aria-valuenow={displayCount} aria-valuemin={0} aria-valuemax={100} aria-label="AI project completion">
          <div style={{
            height: 16,
            borderRadius: 8,
            background: 'rgba(0,0,0,0.07)',
            overflow: 'hidden',
            position: 'relative',
            animation: showStall ? 'sr-shake 0.5s ease-in-out' : 'none',
          }}>
            <div style={{
              position: 'absolute',
              left: 0, top: 0,
              height: '100%',
              width: fillWidth,
              background: fillGradient,
              transition: fillTransition,
            }} />
            {/* Hatch overlay (gap zone) — decorative */}
            <div aria-hidden="true" style={{
              position: 'absolute',
              left: '50%', top: 0,
              width: '50%', height: '100%',
              overflow: 'hidden',
              opacity: showStall ? 1 : 0,
              transition: 'opacity 0.4s',
              pointerEvents: 'none',
            }}>
              <svg width="100%" height="100%" viewBox="0 0 100 16" preserveAspectRatio="none">
                <defs>
                  <pattern id={hatchId} patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(221,0,49,.18)" strokeWidth="4" />
                  </pattern>
                </defs>
                <rect width="100" height="16" fill={`url(#${hatchId})`} />
              </svg>
            </div>
          </div>
          {/* Stall pin — outside the overflow:hidden track, decorative */}
          <div aria-hidden="true" style={{
            position: 'absolute',
            left: '50%',
            top: -8,
            transform: 'translateX(-50%)',
            opacity: showStall ? 1 : 0,
            transition: 'opacity 0.4s',
            pointerEvents: 'none',
            textAlign: 'center',
          }}>
            <div style={{ width: 2, height: 34, background: tokens.colors.angularRed, margin: '0 auto', borderRadius: 1 }} />
            <div style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: 'max(12px, 0.6rem)', color: tokens.colors.angularRed, whiteSpace: 'nowrap', marginTop: 3, fontWeight: 700 }}>
              50% abandon here
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
          }} aria-hidden="true">
            {displayCount}%
          </span>
          <div aria-hidden="true" style={{
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
            Angular Stream Resource closes the gap
          </div>
          <span style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.78rem', fontWeight: 700,
            color: tokens.colors.accent,
            opacity: showEnd ? 1 : 0,
            transition: 'opacity 0.4s',
            minWidth: 40,
            textAlign: 'right',
          }} aria-hidden="true">
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
        @keyframes sr-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-3px)} 40%{transform:translateX(3px)} 60%{transform:translateX(-2px)} 80%{transform:translateX(2px)} }
      `}</style>
    </section>
  );
}
