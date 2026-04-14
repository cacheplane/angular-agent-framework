'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import type { ArchitectureLayer } from '../../../lib/solutions-data';

const LIBRARY_META: Record<string, { color: string; rgb: string; href: string }> = {
  Agent: { color: tokens.colors.accent, rgb: '0,64,144', href: '/angular' },
  Render: { color: tokens.colors.renderGreen, rgb: '26,122,64', href: '/render' },
  Chat: { color: tokens.colors.chatPurple, rgb: '90,0,200', href: '/chat' },
};

interface SolutionArchitectureProps {
  color: string;
  intro: string;
  layers: ArchitectureLayer[];
}

function Connector({ fromRgb, toRgb }: { fromRgb: string; toRgb: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <div
        style={{
          width: 2,
          height: 28,
          background: `linear-gradient(to bottom, rgba(${fromRgb}, 0.3), rgba(${toRgb}, 0.3))`,
          borderRadius: 1,
        }}
      />
    </div>
  );
}

export function SolutionArchitecture({ color, intro, layers }: SolutionArchitectureProps) {
  return (
    <section className="solution-arch" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solution-arch { padding: 60px 20px !important; }
          .solution-arch-card { padding: 24px 20px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 700,
            color,
            marginBottom: 14,
          }}
        >
          The Architecture
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(26px, 3.5vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            marginBottom: 10,
          }}
        >
          Three libraries. One solution.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            color: tokens.colors.textSecondary,
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          {intro}
        </p>
      </motion.div>

      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        {layers.map((layer, i) => {
          const meta = LIBRARY_META[layer.library];
          const prevMeta = i > 0 ? LIBRARY_META[layers[i - 1].library] : null;
          return (
            <div key={layer.library}>
              {i > 0 && prevMeta && (
                <Connector fromRgb={prevMeta.rgb} toRgb={meta.rgb} />
              )}
              <motion.div
                className="solution-arch-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  background: `rgba(${meta.rgb}, 0.03)`,
                  border: `1px solid rgba(${meta.rgb}, 0.15)`,
                  borderRadius: 14,
                  padding: '28px 28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      padding: '2px 9px',
                      borderRadius: 5,
                      color: '#fff',
                      background: meta.color,
                    }}
                  >
                    {layer.library}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: meta.color,
                    }}
                  >
                    {layer.pkg}
                  </span>
                </div>

                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.88rem',
                    color: tokens.colors.textSecondary,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {layer.role}
                </p>

                <Link
                  href={meta.href}
                  style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: meta.color,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Explore {layer.library} →
                </Link>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
