'use client';

import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const features = [
  '3-month structured pilot engagement',
  'stream-resource license for your entire team',
  'Unlimited agent builds after pilot',
  "Money-back guarantee if you don't ship",
];

export function PricingSignal() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <style>{`
        .pricing-signal-btn:hover {
          box-shadow: ${tokens.glow.button};
        }
      `}</style>
      <div style={{ maxWidth: '1152px', margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{
            maxWidth: '672px',
            margin: '0 auto',
            background: tokens.glass.bg,
            border: `1px solid ${tokens.colors.accentBorder}`,
            backdropFilter: `blur(${tokens.glass.blur})`,
            borderRadius: '16px',
            padding: '48px',
            boxShadow: tokens.glow.card,
          }}
        >
          {/* Top label */}
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: tokens.colors.textMuted,
              margin: '0 0 24px',
            }}
          >
            Pilot Program Pricing
          </p>

          {/* Price display */}
          <div style={{ marginBottom: '32px' }}>
            <span
              style={{
                fontFamily: 'EB Garamond, Georgia, serif',
                fontSize: '64px',
                fontWeight: 400,
                color: tokens.colors.textPrimary,
                lineHeight: 1,
              }}
            >
              $20,000
            </span>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                color: tokens.colors.textMuted,
                marginLeft: '4px',
              }}
            >
              / year
            </span>
            <span
              style={{
                display: 'block',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                color: tokens.colors.textSecondary,
                marginTop: '8px',
              }}
            >
              Renewable annually. 3-month pilot included in Year 1.
            </span>
          </div>

          {/* Feature list */}
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 40px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {features.map((feature) => (
              <li
                key={feature}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '15px',
                  color: tokens.colors.textPrimary,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: tokens.colors.accent,
                    fontWeight: 600,
                    flexShrink: 0,
                    lineHeight: '1.5',
                  }}
                >
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div>
            <a
              href="#whitepaper-gate"
              className="pricing-signal-btn"
              style={{
                display: 'inline-block',
                background: tokens.colors.accent,
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                fontWeight: 600,
                padding: '14px 32px',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'box-shadow 0.2s ease',
              }}
            >
              Start Your Pilot
            </a>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: tokens.colors.textSecondary,
                margin: '16px 0 0',
              }}
            >
              Or talk to us first —{' '}
              <a
                href="mailto:hello@cacheplane.io"
                style={{
                  color: tokens.colors.accent,
                  textDecoration: 'none',
                }}
              >
                schedule a call →
              </a>
            </p>
          </div>
        </motion.div>

        {/* Comparison note */}
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: tokens.colors.textMuted,
            marginTop: '24px',
          }}
        >
          Developer seat license available separately at $500/seat/year for teams who&apos;ve already shipped.
        </p>
      </div>
    </section>
  );
}
