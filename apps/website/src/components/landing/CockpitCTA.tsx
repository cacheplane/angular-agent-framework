'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

export function CockpitCTA() {
  return (
    <section className="px-8 py-20 max-w-5xl mx-auto">
      <motion.div
        className="rounded-2xl p-6 md:p-10 lg:p-14"
        style={{
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
        }}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}>

        <p className="font-mono text-xs uppercase tracking-widest mb-4 text-center"
          style={{ color: tokens.colors.accent }}>Interactive Reference</p>
        <h2 style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 800,
          fontSize: 'clamp(28px, 3.5vw, 48px)',
          color: tokens.colors.textPrimary,
          textAlign: 'center',
          marginBottom: 12,
        }}>Explore the Cockpit</h2>
        <p className="text-center mb-10" style={{ color: tokens.colors.textSecondary, maxWidth: '55ch', margin: '0 auto 40px', lineHeight: 1.6 }}>
          Interactive reference implementations for every capability. Run examples, inspect source code, and read guided documentation — all in one place.
        </p>

        {/* Cockpit wireframe mockup */}
        <div className="rounded-xl overflow-hidden mb-10" style={{
          border: `1px solid ${tokens.colors.accentBorder}`,
          background: '#080B14',
        }}>
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FEBC2E' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28C840' }} />
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {['Run', 'Code', 'Docs'].map((tab, i) => (
                <span key={tab} style={{
                  padding: '3px 12px', borderRadius: 4,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  color: i === 0 ? '#6C8EFF' : '#4A527A',
                  background: i === 0 ? 'rgba(108,142,255,0.12)' : 'transparent',
                }}>{tab}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', minHeight: 140 }}>
            <div className="hidden sm:block" style={{ width: 160, borderRight: '1px solid rgba(255,255,255,0.06)', padding: '10px 8px' }}>
              {['LangGraph', 'Streaming', 'Persistence', 'Interrupts'].map((item, i) => (
                <div key={item} style={{
                  padding: '4px 8px', borderRadius: 4, marginBottom: 2,
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: i === 1 ? '#6C8EFF' : '#4A527A',
                  background: i === 1 ? 'rgba(108,142,255,0.08)' : 'transparent',
                }}>{item}</div>
              ))}
            </div>
            <div style={{ flex: 1, padding: 14 }}>
              <div style={{ fontFamily: 'var(--font-garamond)', fontSize: 14, fontWeight: 700, color: '#EEF1FF', marginBottom: 8 }}>
                LangGraph Streaming
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{ flex: 1, height: 40, borderRadius: 4, background: 'rgba(108,142,255,0.04)', border: '1px solid rgba(108,142,255,0.08)' }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-8 mb-10 flex-wrap">
          {[
            { value: '14+', label: 'Capabilities' },
            { value: '2', label: 'Products' },
            { value: '3', label: 'View Modes' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: tokens.colors.accent }}>{s.value}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4 flex-wrap">
          <a href="/docs" className="px-6 py-3 rounded-lg font-mono text-sm transition-all"
            style={{ background: tokens.colors.accent, color: '#fff', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.button)}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
            Launch Cockpit
          </a>
          <a href="/docs" className="px-6 py-3 rounded-lg font-mono text-sm transition-all"
            style={{ border: `1px solid ${tokens.colors.accent}`, color: tokens.colors.accent, textDecoration: 'none' }}>
            Read Docs
          </a>
        </div>
      </motion.div>
    </section>
  );
}
