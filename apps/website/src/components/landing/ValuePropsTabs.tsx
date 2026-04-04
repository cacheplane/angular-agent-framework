'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

interface Tab {
  id: string;
  label: string;
  headline: string;
  description: string;
  codeHtml: string;
}

export function ValuePropsTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="flex gap-2 mb-8 justify-center flex-wrap">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActive(i)}
            className="px-5 py-2.5 rounded-lg font-mono text-sm transition-all"
            style={{
              background: active === i ? tokens.colors.accentSurface : 'transparent',
              color: active === i ? tokens.colors.accent : tokens.colors.textSecondary,
              border: `1px solid ${active === i ? tokens.colors.accentBorderHover : 'transparent'}`,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tabs[active].id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          <div className="p-8 rounded-xl" style={{
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
          }}>
            <h3 style={{
              fontFamily: 'var(--font-garamond)',
              fontWeight: 700,
              fontSize: '1.5rem',
              color: tokens.colors.textPrimary,
              marginBottom: 12,
            }}>{tabs[active].headline}</h3>
            <p style={{
              fontSize: '0.95rem',
              color: tokens.colors.textSecondary,
              lineHeight: 1.7,
            }}>{tabs[active].description}</p>
          </div>

          <div style={{
            borderRadius: 12,
            border: `1px solid ${tokens.glass.border}`,
            boxShadow: tokens.glass.shadow,
            overflow: 'hidden',
          }}>
            <div
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: tabs[active].codeHtml }}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
