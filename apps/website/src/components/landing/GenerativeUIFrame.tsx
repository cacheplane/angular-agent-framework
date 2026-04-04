'use client';
import { useEffect, useRef } from 'react';
import { tokens } from '../../../lib/design-tokens';

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
      aria-label="Animated demo of stream-resource rendering a generative UI"
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
      <div style={{ padding: 20, minHeight: 260, position: 'relative', overflow: 'hidden' }}>
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
            0%, 75% { opacity: 1; }
            97%, 100% { opacity: 0; }
          }
          .gen-ui-loop { animation: loopFade 6s linear infinite; }
          .w1  { animation: fadeWord 0.25s ease-out 0.1s both; }
          .w2  { animation: fadeWord 0.25s ease-out 0.3s both; }
          .w3  { animation: fadeWord 0.25s ease-out 0.5s both; }
          .w4  { animation: fadeWord 0.25s ease-out 0.7s both; }
          .w5  { animation: fadeWord 0.25s ease-out 0.9s both; }
          .w6  { animation: fadeWord 0.25s ease-out 1.1s both; }
          .card-title { animation: cardIn 0.3s ease-out 1.5s both; }
          .card-body  { animation: cardIn 0.3s ease-out 1.9s both; }
          .card-btn   { animation: cardIn 0.3s ease-out 2.3s both; }
          .row1 { animation: rowIn 0.25s ease-out 3.0s both; }
          .row2 { animation: rowIn 0.25s ease-out 3.4s both; }
          .row3 { animation: rowIn 0.25s ease-out 3.8s both; }
        `}</style>

        <div className="gen-ui-loop">
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(108,142,255,0.2)', border: '1px solid rgba(108,142,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6C8EFF',
            }}>AI</div>
            <div style={{
              background: 'rgba(108,142,255,0.08)', borderRadius: 8,
              padding: '8px 12px', fontSize: 13, color: '#EEF1FF', lineHeight: 1.5,
            }}>
              <span className="w1">Here </span>
              <span className="w2">is </span>
              <span className="w3">your </span>
              <span className="w4">quarterly </span>
              <span className="w5">report </span>
              <span className="w6">summary.</span>
            </div>
          </div>

          <div style={{
            border: '1px solid rgba(108,142,255,0.2)', borderRadius: 8,
            padding: '12px 14px', marginBottom: 12,
          }}>
            <div className="card-title" style={{
              fontFamily: 'var(--font-garamond)', fontSize: 15, fontWeight: 700,
              color: '#EEF1FF', marginBottom: 6,
            }}>Q1 2026 Revenue</div>
            <div className="card-body" style={{
              fontSize: 12, color: '#8B96C8', lineHeight: 1.5, marginBottom: 10,
            }}>Revenue up 24% YoY. Strongest quarter on record across all segments.</div>
            <div className="card-btn" style={{
              display: 'inline-block', padding: '5px 12px', borderRadius: 5,
              background: 'rgba(108,142,255,0.15)',
              border: '1px solid rgba(108,142,255,0.3)',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6C8EFF',
            }}>View details &rarr;</div>
          </div>

          <div style={{ border: '1px solid rgba(108,142,255,0.15)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              padding: '6px 12px', background: 'rgba(108,142,255,0.06)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: '#4A527A', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <span>Segment</span><span>Revenue</span><span>Growth</span>
            </div>
            {[
              { seg: 'Enterprise', rev: '$4.2M', growth: '+31%', cls: 'row1' },
              { seg: 'SMB', rev: '$2.1M', growth: '+18%', cls: 'row2' },
              { seg: 'Developer', rev: '$0.8M', growth: '+42%', cls: 'row3' },
            ].map((r) => (
              <div key={r.seg} className={r.cls} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                padding: '6px 12px',
                borderTop: '1px solid rgba(108,142,255,0.08)',
                fontSize: 12, color: '#8B96C8',
              }}>
                <span>{r.seg}</span>
                <span style={{ color: '#EEF1FF' }}>{r.rev}</span>
                <span style={{ color: '#6C8EFF' }}>{r.growth}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
