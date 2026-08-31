'use client';

import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import type { CtaId } from '../../lib/analytics/events';
import { TIERS, type TierConfig } from '../../../../../pricing/tiers.config';

interface PlanCta {
  readonly label: string;
  readonly ctaId: CtaId;
  readonly href: string;
  readonly external?: boolean;
}

const CTAS: Record<TierConfig['slug'], PlanCta> = {
  community: {
    label: 'Install from npm',
    ctaId: 'pricing_tier_community',
    href: 'https://www.npmjs.com/package/@threadplane/chat',
    external: true,
  },
  production_assurance: {
    label: 'Discuss assurance',
    ctaId: 'pricing_tier_production_assurance',
    href: '/contact?source=pricing_production_assurance',
  },
  enterprise: {
    label: 'Talk to Sales',
    ctaId: 'pricing_tier_enterprise',
    href: '/contact?source=pricing_tier_enterprise',
  },
};

function PlanButton({ tier }: { tier: TierConfig }) {
  const cta = CTAS[tier.slug];
  return (
    <Button
      variant={tier.highlight ? 'primary' : 'secondary'}
      size="md"
      className="pricing-plan-btn"
      href={cta.href}
      {...(cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() =>
        trackCtaClick({
          surface: 'pricing',
          destination_url: cta.href,
          cta_id: cta.ctaId,
          cta_text: cta.label,
        })
      }
    >
      {cta.label}
    </Button>
  );
}

function PlanCard({ tier }: { tier: TierConfig }) {
  const headingId = `pricing-plan-${tier.slug}`;
  return (
    <article
      className="pricing-plan-card"
      data-highlight={tier.highlight || undefined}
      aria-labelledby={headingId}
    >
      {tier.highlight ? <div className="pricing-plan-popular">Production support</div> : null}
      <div className="pricing-plan-stage-row">
        <span className="pricing-plan-stage">{tier.stageLabel}</span>
        <span className="pricing-plan-journey">{tier.journeyLabel}</span>
      </div>
      <h3 id={headingId} className="pricing-plan-name">{tier.displayName}</h3>
      <div className="pricing-plan-price-block">
        <div className="pricing-plan-price">
          <span className="pricing-plan-price-amount">{tier.price}</span>
        </div>
        <p className="pricing-plan-price-qualifier">{tier.priceQualifier}</p>
      </div>
      <p className="pricing-plan-description">{tier.description}</p>
      <ul className="pricing-plan-feature-list">
        {tier.features.map((feature) => (
          <li key={feature} className="pricing-plan-feature">
            <span aria-hidden="true" className="pricing-plan-feature-mark">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <p className="pricing-plan-billing-note">Best for: {tier.bestFor}</p>
      <div className="pricing-plan-action"><PlanButton tier={tier} /></div>
    </article>
  );
}

export function CompareTable() {
  return (
    <section className="pricing-plans-section" aria-labelledby="pricing-plans-heading">
      <h2 id="pricing-plans-heading" className="sr-only">Software and support for every shipping stage</h2>
      <div className="pricing-plan-grid">
        {TIERS.map((tier) => <PlanCard key={tier.slug} tier={tier} />)}
      </div>
    </section>
  );
}
