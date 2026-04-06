'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const STATS = [
  { value: '14+', label: 'Capabilities' },
  { value: '100%', label: 'Signal-Native' },
  { value: '20+', label: 'Angular Version' },
  { value: 'OSS', label: 'Source Available' },
];

export function StatsStrip() {
  return (
    <section className="px-8 py-16 max-w-5xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="text-center py-8 rounded-xl"
            style={{
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(28px, 3vw, 40px)',
              fontWeight: 700,
              color: tokens.colors.accent,
              marginBottom: 4,
            }}>{stat.value}</div>
            <div style={{
              fontFamily: 'var(--font-garamond)',
              fontSize: '0.9rem',
              color: tokens.colors.textSecondary,
            }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
