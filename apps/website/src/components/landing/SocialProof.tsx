'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const BADGES = [
  { icon: '★', label: 'GitHub Stars', value: 'Open Source' },
  { icon: '↓', label: 'npm', value: '@cacheplane/angular' },
  { icon: '⚖', label: 'License', value: 'Source Available' },
];

export function SocialProof() {
  return (
    <section className="px-8 py-6 max-w-3xl mx-auto">
      <motion.div
        className="flex flex-wrap justify-center gap-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {BADGES.map((badge) => (
          <div
            key={badge.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 20,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              color: tokens.colors.textSecondary,
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>{badge.icon}</span>
            <span>{badge.value}</span>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
