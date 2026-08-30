'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import type { CtaId } from '../../lib/analytics/events';
import {
  TIERS,
  type TierConfig,
  type BillingCycle,
  annualDiscountPercent,
  annualSavingsDollars,
} from '../../../../../pricing/tiers.config';

interface PlanCta {
  readonly label: string;
  readonly ctaId: CtaId;
  readonly stripeBuyable?: boolean;
  readonly href?: string;
  readonly external?: boolean;
}

const CTAS: Record<TierConfig['slug'], PlanCta> = {
  community: {
    label: 'Start free',
    ctaId: 'pricing_tier_community',
    href: 'https://www.npmjs.com/package/@threadplane/chat',
    external: true,
  },
  developer_seat: {
    label: 'Get Pro',
    ctaId: 'pricing_tier_developer_seat',
    stripeBuyable: true,
  },
  team: {
    label: 'Get Team',
    ctaId: 'pricing_tier_team',
    stripeBuyable: true,
  },
  enterprise: {
    label: 'Talk to Sales',
    ctaId: 'pricing_tier_enterprise',
    href: '/contact?source=pricing_tier_enterprise',
  },
};

function PlanButton({ tier, cycle }: { tier: TierConfig; cycle: BillingCycle }) {
  const cta = CTAS[tier.slug];
  const variant = tier.highlight ? 'primary' : 'secondary';
  const trackClick = (destinationUrl: string) =>
    trackCtaClick({
      surface: 'pricing',
      destination_url: destinationUrl,
      cta_id: cta.ctaId,
      cta_text: cta.label,
    });

  if (cta.stripeBuyable) {
    return (
      <form action="/api/checkout/session" method="post" className="pricing-plan-form">
        <input type="hidden" name="tier" value={tier.slug} />
        <input type="hidden" name="billing_cycle" value={cycle} />
        <Button
          variant={variant}
          size="md"
          className="pricing-plan-btn"
          type="submit"
          onClick={() => trackClick('/api/checkout/session')}
        >
          {cta.label}
        </Button>
      </form>
    );
  }

  const href = cta.href;
  if (!href) return null;

  return (
    <Button
      variant={variant}
      size="md"
      className="pricing-plan-btn"
      href={href}
      {...(cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => trackClick(href)}
    >
      {cta.label}
    </Button>
  );
}

function BillingToggle({
  cycle,
  setCycle,
}: {
  cycle: BillingCycle;
  setCycle: (cycle: BillingCycle) => void;
}) {
  const discountPct = annualDiscountPercent();

  return (
    <fieldset className="pricing-billing-fieldset">
      <legend className="sr-only">Billing cycle</legend>
      <div role="radiogroup" aria-label="Billing cycle" className="pricing-billing-toggle">
        {(['monthly', 'annual'] as const).map((value) => {
          const selected = cycle === value;
          const label = value === 'monthly'
            ? 'Monthly'
            : `Annual — save up to ${discountPct}%`;
          return (
            <label
              key={value}
              className="pricing-billing-tab"
              data-active={selected || undefined}
            >
              <input
                type="radio"
                name="billing-cycle"
                value={value}
                checked={selected}
                aria-label={label}
                aria-checked={selected}
                onChange={() => setCycle(value)}
                className="sr-only"
              />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Price({ tier, cycle }: { tier: TierConfig; cycle: BillingCycle }) {
  const price = tier.prices[cycle];
  const savings = annualSavingsDollars(tier);
  const isAnnualPaid = cycle === 'annual' && price.cents != null;

  return (
    <div className="pricing-plan-price-block">
      <div className="pricing-plan-price">
        {tier.slug === 'community' ? (
          <span className="pricing-plan-price-amount">Free forever</span>
        ) : (
          <>
            <span className="pricing-plan-price-amount">{price.display}</span>
            {price.period ? <span className="pricing-plan-price-period">{price.period}</span> : null}
          </>
        )}
      </div>
      <p className="pricing-plan-price-qualifier">{tier.priceQualifier}</p>
      {isAnnualPaid ? (
        <p className="pricing-plan-billing-note">
          Billed annually{savings > 0 ? ` · save $${savings} per year` : ''}
        </p>
      ) : tier.slug === 'enterprise' ? (
        <p className="pricing-plan-billing-note">Sales-led pricing</p>
      ) : null}
      {tier.additionalQualifier ? (
        <p className="pricing-plan-additional-qualifier">{tier.additionalQualifier}</p>
      ) : null}
    </div>
  );
}

function PlanCard({ tier, cycle }: { tier: TierConfig; cycle: BillingCycle }) {
  const headingId = `pricing-plan-${tier.slug}`;

  return (
    <article
      className="pricing-plan-card"
      data-highlight={tier.highlight || undefined}
      aria-labelledby={headingId}
    >
      {tier.highlight ? <div className="pricing-plan-popular">Most popular</div> : null}
      <div className="pricing-plan-stage-row">
        <span className="pricing-plan-stage">{tier.stageLabel}</span>
        <span className="pricing-plan-journey">{tier.journeyLabel}</span>
      </div>
      <h3 id={headingId} className="pricing-plan-name">{tier.displayName}</h3>
      <Price tier={tier} cycle={cycle} />
      <p className="pricing-plan-description">{tier.description}</p>
      <ul className="pricing-plan-feature-list">
        {tier.features.map((feature) => (
          <li key={feature} className="pricing-plan-feature">
            <span aria-hidden="true" className="pricing-plan-feature-mark">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="pricing-plan-action">
        <PlanButton tier={tier} cycle={cycle} />
      </div>
    </article>
  );
}

export function CompareTable() {
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  return (
    <section className="pricing-plans-section" aria-labelledby="pricing-plans-heading">
      <h2 id="pricing-plans-heading" className="sr-only">Plans for every shipping stage</h2>
      <BillingToggle cycle={cycle} setCycle={setCycle} />
      <div className="pricing-plan-grid">
        {TIERS.map((tier) => (
          <PlanCard key={tier.slug} tier={tier} cycle={cycle} />
        ))}
      </div>
    </section>
  );
}
