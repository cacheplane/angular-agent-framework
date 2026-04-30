'use client';
import { tokens } from '@cacheplane/design-tokens';

const PLANS = [
  {
    name: 'Open Source',
    price: 'Free',
    period: 'forever',
    features: ['MIT License', 'All libraries', 'Commercial use welcome', 'Community support'],
    highlight: false,
    cta: 'Get Started',
    ctaHref: 'https://www.npmjs.com/package/@cacheplane/langgraph',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact for details',
    features: ['Priority support', 'SLA', 'Managed service (coming soon)', 'Custom contract'],
    highlight: true,
    cta: 'Contact Us',
    ctaHref: '#lead-form',
  },
];

export function PricingGrid() {
  return (
    <section className="px-8 py-16 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className="p-8 rounded-xl flex flex-col"
            style={{
              border: `1px solid ${plan.highlight ? tokens.colors.accent : tokens.glass.border}`,
              boxShadow: plan.highlight ? tokens.glow.card : tokens.glass.shadow,
              background: plan.highlight ? 'rgba(255, 255, 255, 0.55)' : tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            }}>
            <p
              className="font-mono text-xs uppercase tracking-widest mb-4"
              style={{ color: tokens.colors.accent }}>
              {plan.name}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-garamond)',
                fontWeight: 700,
                fontSize: 48,
                color: tokens.colors.textPrimary,
                lineHeight: 1,
                marginBottom: 4,
              }}>
              {plan.price}
            </p>
            <p className="text-sm mb-8" style={{ color: tokens.colors.textMuted }}>{plan.period}</p>
            <ul className="flex flex-col gap-2 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="text-sm flex items-center gap-2" style={{ color: tokens.colors.textSecondary }}>
                  <span style={{ color: tokens.colors.accent }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href={plan.ctaHref}
              className="text-center py-3 px-6 rounded font-mono text-sm transition-all"
              style={{
                background: plan.highlight ? tokens.colors.accent : 'transparent',
                color: plan.highlight ? '#fff' : tokens.colors.accent,
                border: `1px solid ${tokens.colors.accent}`,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.button)}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
              {plan.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
