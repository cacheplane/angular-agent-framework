'use client';
import { useEffect, useRef } from 'react';
import { tokens } from '@cacheplane/design-tokens';

export function GenerativeUIFrame() {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = frame.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(e.clientX - cx, e.clientY - cy);
      const intensity = 0.08 + 0.2 * Math.max(0, 1 - distance / 400);
      const blur = 10 + intensity * 40;
      frame.style.boxShadow = `0 0 ${blur}px rgba(0,64,144,${intensity.toFixed(2)})`;
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label="Animated demo of Angular Stream Resource orchestrating a multi-step agent UI"
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${tokens.glass.border}`,
        background: '#080B14',
        boxShadow: tokens.glow.demo,
        transition: 'box-shadow 0.1s ease-out',
        width: '100%',
        maxWidth: 520,
      }}>
      {/* Browser chrome */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
        </div>
        <div style={{
          flex: 1, background: 'rgba(255,255,255,0.06)',
          borderRadius: 4, padding: '3px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: '#4A527A', textAlign: 'center',
        }}>
          localhost:4200
        </div>
      </div>

      {/* Animated content area — stays dark themed */}
      <div style={{ padding: 20, minHeight: 280, position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes fadeWord {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes cardIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes rowIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes loopFade {
            0%, 75%  { opacity: 1; }
            97%, 100% { opacity: 0; }
          }
          @keyframes checkIn {
            from { opacity: 0; transform: scale(0.6); }
            to   { opacity: 1; transform: scale(1); }
          }
          @keyframes stepIn {
            from { opacity: 0; transform: translateX(-6px); }
            to   { opacity: 1; transform: translateX(0); }
          }

          /* Loop wrapper: 7s total cycle (5.5s visible, fade, restart) */
          .gen-ui-loop { animation: loopFade 7s linear infinite; }

          /* Phase 1 — user message words (0s–1s) */
          .w1 { animation: fadeWord 0.2s ease-out 0.05s both; }
          .w2 { animation: fadeWord 0.2s ease-out 0.20s both; }
          .w3 { animation: fadeWord 0.2s ease-out 0.35s both; }
          .w4 { animation: fadeWord 0.2s ease-out 0.50s both; }
          .w5 { animation: fadeWord 0.2s ease-out 0.65s both; }
          .w6 { animation: fadeWord 0.2s ease-out 0.80s both; }
          .w7 { animation: fadeWord 0.2s ease-out 0.95s both; }

          /* Phase 2 — planning card (1.2s–2s) */
          .plan-card   { animation: cardIn 0.3s ease-out 1.2s both; }
          .plan-item1  { animation: stepIn 0.25s ease-out 1.45s both; }
          .plan-item2  { animation: stepIn 0.25s ease-out 1.65s both; }
          .plan-item3  { animation: stepIn 0.25s ease-out 1.85s both; }

          /* Phase 3 — step execution (2.2s–4s) */
          /* Step 1: query */
          .step1-label { animation: stepIn  0.25s ease-out 2.2s both; }
          .step1-check { animation: checkIn 0.2s  ease-out 2.7s both; }
          .step1-row1  { animation: rowIn   0.2s  ease-out 2.85s both; }
          .step1-row2  { animation: rowIn   0.2s  ease-out 3.0s  both; }

          /* Step 2: analysis */
          .step2-label  { animation: stepIn  0.25s ease-out 3.1s  both; }
          .step2-check  { animation: checkIn 0.2s  ease-out 3.55s both; }
          .step2-metric { animation: rowIn   0.2s  ease-out 3.7s  both; }

          /* Step 3: report */
          .step3-label { animation: stepIn  0.25s ease-out 3.75s both; }
          .step3-check { animation: checkIn 0.2s  ease-out 4.05s both; }

          /* Phase 4 — summary card (4.2s–5s) */
          .summary-card { animation: cardIn 0.35s ease-out 4.2s both; }
          .summary-text { animation: rowIn  0.3s  ease-out 4.6s both; }
        `}</style>

        <div className="gen-ui-loop">

          {/* ── Phase 1: User message ── */}
          <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
            <div style={{
              background: 'rgba(108,142,255,0.13)',
              border: '1px solid rgba(108,142,255,0.25)',
              borderRadius: '10px 10px 2px 10px',
              padding: '7px 11px', fontSize: 12.5,
              color: '#C8D0F5', lineHeight: 1.5, maxWidth: '80%',
            }}>
              <span className="w1">Analyze </span>
              <span className="w2">our </span>
              <span className="w3">Q1 </span>
              <span className="w4">customer </span>
              <span className="w5">churn </span>
              <span className="w6">data</span>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6B7399',
            }}>U</div>
          </div>

          {/* ── Phase 2: Planning card ── */}
          <div className="plan-card" style={{
            marginBottom: 12,
            border: '1px solid rgba(108,142,255,0.2)',
            borderRadius: 8, padding: '10px 12px',
            background: 'rgba(108,142,255,0.04)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: '#6C8EFF', letterSpacing: '0.07em',
              textTransform: 'uppercase', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6,
                borderRadius: '50%', background: '#6C8EFF',
                boxShadow: '0 0 5px rgba(108,142,255,0.7)',
              }} />
              Planning · 3 steps
            </div>
            {[
              { cls: 'plan-item1', label: 'Query churn database' },
              { cls: 'plan-item2', label: 'Run statistical analysis' },
              { cls: 'plan-item3', label: 'Generate executive report' },
            ].map((item, i) => (
              <div key={i} className={item.cls} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: '#5A638A', marginBottom: i < 2 ? 5 : 0,
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: '1px solid rgba(108,142,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, color: '#4A527A', flexShrink: 0,
                }}>{i + 1}</span>
                {item.label}
              </div>
            ))}
          </div>

          {/* ── Phase 3: Step execution ── */}
          <div style={{
            border: '1px solid rgba(108,142,255,0.15)',
            borderRadius: 8, overflow: 'hidden',
            marginBottom: 12,
          }}>
            {/* Step 1 — Querying database */}
            <div style={{ padding: '9px 12px', borderBottom: '1px solid rgba(108,142,255,0.08)' }}>
              <div className="step1-label" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8B96C8',
                marginBottom: 6,
              }}>
                <span className="step1-check" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'rgba(40,200,100,0.15)',
                  border: '1px solid rgba(40,200,100,0.4)',
                  fontSize: 8, color: '#28C864', flexShrink: 0,
                }}>✓</span>
                Querying database...
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 4,
                overflow: 'hidden', border: '1px solid rgba(108,142,255,0.08)',
              }}>
                {[
                  { col1: 'cohort', col2: 'churned', col3: 'retained' },
                  { col1: 'Jan 2026', col2: '312', col3: '4,208' },
                  { col1: 'Feb 2026', col2: '287', col3: '4,451' },
                ].map((row, i) => (
                  <div key={i} className={i === 0 ? 'step1-label' : i === 1 ? 'step1-row1' : 'step1-row2'} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    padding: '4px 8px',
                    borderTop: i > 0 ? '1px solid rgba(108,142,255,0.06)' : undefined,
                    fontFamily: 'var(--font-mono)',
                    fontSize: i === 0 ? 9 : 11,
                    color: i === 0 ? '#4A527A' : '#8B96C8',
                    textTransform: i === 0 ? 'uppercase' : undefined,
                    letterSpacing: i === 0 ? '0.07em' : undefined,
                  }}>
                    <span>{row.col1}</span>
                    <span style={{ color: i > 0 ? '#EEF1FF' : undefined }}>{row.col2}</span>
                    <span style={{ color: i > 0 ? '#6C8EFF' : undefined }}>{row.col3}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 — Running analysis */}
            <div style={{ padding: '9px 12px', borderBottom: '1px solid rgba(108,142,255,0.08)' }}>
              <div className="step2-label" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8B96C8',
                marginBottom: 6,
              }}>
                <span className="step2-check" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'rgba(40,200,100,0.15)',
                  border: '1px solid rgba(40,200,100,0.4)',
                  fontSize: 8, color: '#28C864', flexShrink: 0,
                }}>✓</span>
                Running analysis...
              </div>
              <div className="step2-metric" style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 6,
                background: 'rgba(108,142,255,0.08)',
                border: '1px solid rgba(108,142,255,0.2)',
                borderRadius: 5, padding: '4px 10px',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5A638A' }}>Churn rate</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#6C8EFF' }}>4.2%</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#28C864' }}>▼ vs 4.9% last Q</span>
              </div>
            </div>

            {/* Step 3 — Generating report */}
            <div style={{ padding: '9px 12px' }}>
              <div className="step3-label" style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8B96C8',
              }}>
                <span className="step3-check" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'rgba(40,200,100,0.15)',
                  border: '1px solid rgba(40,200,100,0.4)',
                  fontSize: 8, color: '#28C864', flexShrink: 0,
                }}>✓</span>
                Generating report...
              </div>
            </div>
          </div>

          {/* ── Phase 4: Summary card ── */}
          <div className="summary-card" style={{
            border: '1px solid rgba(108,142,255,0.25)',
            borderRadius: 8, padding: '11px 13px',
            background: 'rgba(108,142,255,0.06)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(108,142,255,0.2)', border: '1px solid rgba(108,142,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6C8EFF',
            }}>AI</div>
            <div>
              <div style={{
                fontFamily: 'var(--font-garamond)', fontSize: 13, fontWeight: 700,
                color: '#EEF1FF', marginBottom: 5,
              }}>Q1 Churn Analysis</div>
              <div className="summary-text" style={{
                fontSize: 12, color: '#8B96C8', lineHeight: 1.6,
              }}>
                Churn decreased{' '}
                <span style={{ color: '#28C864', fontWeight: 600 }}>12% QoQ</span>
                , driven by improved onboarding. Jan cohort shows strongest retention in 4 quarters.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
