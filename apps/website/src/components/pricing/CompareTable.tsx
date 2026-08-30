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
} from '../../../../../pricing/tiers.config';

interface PlanCta {
  readonly cta: string;
  readonly ctaId: CtaId;
  readonly stripeBuyable?: boolean;
  readonly ctaHref?: string;
  readonly ctaExternal?: boolean;
}

const CTAS: Record<TierConfig['slug'], PlanCta> = {
  community: {
    cta: 'Start free',
    ctaId: 'pricing_tier_community',
    ctaHref: 'https://www.npmjs.com/package/@threadplane/chat',
    ctaExternal: true,
  },
  developer_seat: {
    cta: 'Get Developer Seat',
    ctaId: 'pricing_tier_developer_seat',
    stripeBuyable: true,
  },
  team: {
    cta: 'Get Team',
    ctaId: 'pricing_tier_team',
    stripeBuyable: true,
  },
  enterprise: {
    cta: 'Talk to Sales',
    ctaId: 'pricing_tier_enterprise',
    ctaHref: '/contact?source=pricing_tier_enterprise',
  },
};

type CellValue = boolean | string;
interface FeatureRow {
  feature: string;
  cells: Record<TierConfig['slug'], CellValue>;
}

const LICENSING_ROWS: FeatureRow[] = [
  {
    feature: 'Commercial',
    cells: { community: false, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Developers',
    cells: {
      community: 'Unlimited (noncommercial)',
      developer_seat: 'Per seat',
      team: '5 included',
      enterprise: 'Unlimited',
    },
  },
  {
    feature: '30-day commercial eval',
    cells: { community: true, developer_seat: false, team: false, enterprise: false },
  },
  {
    feature: 'Support',
    cells: { community: 'GitHub', developer_seat: 'GitHub', team: 'Email', enterprise: 'Slack Connect' },
  },
  {
    feature: 'SLA',
    cells: { community: false, developer_seat: false, team: false, enterprise: true },
  },
  {
    feature: 'Pilot-to-Prod',
    cells: { community: false, developer_seat: false, team: false, enterprise: 'Weekly 30-min check-in' },
  },
];

const FEATURE_ROWS: FeatureRow[] = [
  { feature: 'Headless chat primitives', cells: allInclusive() },
  { feature: 'Durable threads', cells: allInclusive() },
  { feature: 'Interrupts (human-in-the-loop)', cells: allInclusive() },
  { feature: 'Subagents + delegation', cells: allInclusive() },
  { feature: 'Planning + memory', cells: allInclusive() },
  { feature: 'Generative UI (json-render + A2UI)', cells: allInclusive() },
  { feature: 'Signal-based streaming', cells: allInclusive() },
  { feature: 'Citations + sources panel', cells: allInclusive() },
  { feature: 'LangGraph + AG-UI adapters', cells: allInclusive() },
  { feature: 'Theme presets (light/dark, Material 3)', cells: allInclusive() },
];

function allInclusive(): Record<TierConfig['slug'], CellValue> {
  return { community: true, developer_seat: true, team: true, enterprise: true };
}

const Check = () => (
  <span className="pricing-compare-check" aria-label="included">✓</span>
);
const Dash = () => (
  <span className="pricing-compare-dash" aria-label="not included">—</span>
);

function renderCell(value: CellValue): React.ReactNode {
  if (typeof value === 'boolean') return value ? <Check /> : <Dash />;
  if (value === '—') return <Dash />;
  return <span className="pricing-compare-cell-text">{value}</span>;
}

function PlanButton({ tier, cycle }: { tier: TierConfig; cycle: BillingCycle }) {
  const cta = CTAS[tier.slug];
  const variant: 'primary' | 'secondary' = tier.highlight ? 'primary' : 'secondary';
  const common = {
    variant,
    size: 'md' as const,
    className: 'pricing-plan-btn',
  };
  if (cta.stripeBuyable) {
    return (
      <form action="/api/checkout/session" method="post">
        <input type="hidden" name="tier" value={tier.slug} />
        <input type="hidden" name="billing_cycle" value={cycle} />
        <Button
          {...common}
          type="submit"
          onClick={() =>
            trackCtaClick({
              surface: 'pricing',
              destination_url: '/api/checkout/session',
              cta_id: cta.ctaId,
              cta_text: cta.cta,
            })
          }
        >
          {cta.cta}
        </Button>
      </form>
    );
  }
  return (
    <Button
      {...common}
      href={cta.ctaHref!}
      {...(cta.ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() =>
        trackCtaClick({
          surface: 'pricing',
          destination_url: cta.ctaHref!,
          cta_id: cta.ctaId,
          cta_text: cta.cta,
        })
      }
    >
      {cta.cta}
    </Button>
  );
}

const LABEL_COL_WIDTH = '22%';

function BillingToggle({
  cycle,
  setCycle,
  discountPct,
}: {
  cycle: BillingCycle;
  setCycle: (c: BillingCycle) => void;
  discountPct: number;
}) {
  return (
    <div className="pricing-billing-toggle-wrap">
      <div role="tablist" aria-label="Billing cycle" className="pricing-billing-toggle">
        <button
          role="tab"
          aria-selected={cycle === 'monthly'}
          onClick={() => setCycle('monthly')}
          className="pricing-billing-tab"
          data-active={cycle === 'monthly' || undefined}
        >
          Monthly
        </button>
        <button
          role="tab"
          aria-selected={cycle === 'annual'}
          onClick={() => setCycle('annual')}
          className="pricing-billing-tab"
          data-active={cycle === 'annual' || undefined}
        >
          Annual{discountPct > 0 ? ` — save ${discountPct}%` : ''}
        </button>
      </div>
    </div>
  );
}

function SectionTable({
  title,
  rows,
  cycle,
  showPrice,
}: {
  title: string;
  rows: FeatureRow[];
  cycle: BillingCycle;
  showPrice: boolean;
}) {
  return (
    <div className="pricing-compare-scroll">
      <div className="pricing-compare-box">
        <table className="pricing-compare-table">
          <thead>
            <tr>
              <th className="pricing-compare-th-label">
                {title}
              </th>
              {TIERS.map((tier) => (
                <th
                  key={tier.slug}
                  className="pricing-compare-th-tier"
                  data-highlight={tier.highlight || undefined}
                >
                  {tier.highlight && (
                    <div className="pricing-compare-badge">
                      MOST POPULAR
                    </div>
                  )}
                  <div
                    className="pricing-compare-tier-name"
                    data-highlight={tier.highlight || undefined}
                  >
                    {tier.name}
                  </div>
                </th>
              ))}
            </tr>
            {showPrice ? (
              <tr>
                <th scope="row" className="pricing-compare-price-label-th">
                  Price
                </th>
                {TIERS.map((tier) => {
                  const p = tier.prices[cycle];
                  return (
                    <th
                      key={tier.slug}
                      className="pricing-compare-price-th"
                      data-highlight={tier.highlight || undefined}
                    >
                      <div className="pricing-compare-price-row">
                        <span className="pricing-compare-price-amount">
                          {p.display}
                        </span>
                        {p.period && (
                          <span className="pricing-compare-price-period">
                            {p.period}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ) : (
              <tr>
                <th className="pricing-compare-spacer-label-th" />
                {TIERS.map((tier) => (
                  <th
                    key={tier.slug}
                    className="pricing-compare-spacer-th"
                    data-highlight={tier.highlight || undefined}
                  />
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.feature}
                className="pricing-compare-row"
                data-last={i === rows.length - 1 || undefined}
              >
                <td className="pricing-compare-td-label">
                  {row.feature}
                </td>
                {TIERS.map((tier) => (
                  <td
                    key={tier.slug}
                    className="pricing-compare-td"
                    data-highlight={tier.highlight || undefined}
                  >
                    {renderCell(row.cells[tier.slug])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CtaStrip({ cycle }: { cycle: BillingCycle }) {
  return (
    <div
      className="pricing-cta-strip"
      style={{ '--cta-cols': `${LABEL_COL_WIDTH} repeat(${TIERS.length}, 1fr)` } as React.CSSProperties}
    >
      <div />
      {TIERS.map((tier) => (
        <div key={tier.slug} className="pricing-compare-cta-cell">
          <div className="pricing-compare-cta-btn-wrap">
            <PlanButton tier={tier} cycle={cycle} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompareTable() {
  const [cycle, setCycle] = useState<BillingCycle>('annual');
  const discountPct = annualDiscountPercent();

  return (
    <section className="pricing-compare-section" aria-label="Pricing comparison">
      <BillingToggle cycle={cycle} setCycle={setCycle} discountPct={discountPct} />

      <SectionTable title="Licensing" rows={LICENSING_ROWS} cycle={cycle} showPrice />
      <div className="pricing-compare-scroll">
        <CtaStrip cycle={cycle} />
      </div>

      <div className="pricing-compare-spacer" />

      <SectionTable title="What's in the box" rows={FEATURE_ROWS} cycle={cycle} showPrice={false} />
      <div className="pricing-compare-scroll">
        <CtaStrip cycle={cycle} />
      </div>
    </section>
  );
}
