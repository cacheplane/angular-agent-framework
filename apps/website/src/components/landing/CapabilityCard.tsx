'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@ngaf/design-tokens';

interface Props {
  icon: string;
  title: string;
  description: string;
  codeHtml: string;
  tint: 'blue' | 'red';
  cockpitHref?: string;
  index: number;
}

export function CapabilityCard({ icon, title, description, codeHtml, tint, cockpitHref, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = tint === 'blue' ? 'rgba(0, 64, 144, 0.2)' : 'rgba(221, 0, 49, 0.2)';
  const hoverBorder = tint === 'blue' ? 'rgba(0, 64, 144, 0.4)' : 'rgba(221, 0, 49, 0.4)';
  const hoverGlow = tint === 'blue' ? '0 0 24px rgba(0,64,144,0.1)' : '0 0 24px rgba(221,0,49,0.1)';

  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${borderColor}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      whileHover={{ borderColor: hoverBorder, boxShadow: hoverGlow }}>

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '1.25rem' }} aria-hidden="true">{icon}</span>
            <h3 style={{
              fontFamily: 'var(--font-garamond)',
              fontWeight: 700,
              fontSize: '1.1rem',
              color: tokens.colors.textPrimary,
            }}>{title}</h3>
          </div>
        </div>
        <p style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
          {description}
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="font-mono text-xs transition-colors"
          style={{ color: tokens.colors.accent }}>
          {expanded ? '\u25BE Hide code' : '\u25B8 Show code'}
        </button>
        {cockpitHref && (
          <a href={cockpitHref} className="font-mono text-xs ml-4 transition-colors" style={{ color: tokens.colors.textMuted }}>
            View in Cockpit \u2192
          </a>
        )}
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${borderColor}` }}>
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: codeHtml }}
          />
        </div>
      )}
    </motion.div>
  );
}
