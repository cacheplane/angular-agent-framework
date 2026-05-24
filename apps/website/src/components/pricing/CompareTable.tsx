'use client';

import { useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
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
    ctaHref: 'https://www.npmjs.com/package/@ngaf/chat',
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
  <span style={{ color: tokens.colors.accent, fontWeight: 700 }} aria-label="included">✓</span>
);
const Dash = () => (
  <span style={{ color: tokens.colors.textMuted }} aria-label="not included">—</span>
);

function renderCell(value: CellValue): React.ReactNode {
  if (typeof value === 'boolean') return value ? <Check /> : <Dash />;
  if (value === '—') return <Dash />;
  return <span style={{ color: tokens.colors.textSecondary }}>{value}</span>;
}

function PlanButton({ tier, cycle }: { tier: TierConfig; cycle: BillingCycle }) {
  const cta = CTAS[tier.slug];
  const variant: 'primary' | 'secondary' = tier.highlight ? 'primary' : 'secondary';
  const common = {
    variant,
    size: 'md' as const,
    style: { width: '100%' },
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
  const baseBtn = {
    fontFamily: tokens.typography.fontSans,
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 16px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 150ms ease, color 150ms ease',
    background: 'transparent',
    color: tokens.colors.textSecondary,
    borderRadius: 999,
  } as const;
  const activeBtn = {
    ...baseBtn,
    background: tokens.colors.accent,
    color: '#fff',
  } as const;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
      <div
        role="tablist"
        aria-label="Billing cycle"
        style={{
          display: 'inline-flex',
          padding: 4,
          background: tokens.surfaces.surfaceTinted,
          border: `1px solid ${tokens.surfaces.border}`,
          borderRadius: 999,
          gap: 4,
        }}
      >
        <button
          role="tab"
          aria-selected={cycle === 'monthly'}
          onClick={() => setCycle('monthly')}
          style={cycle === 'monthly' ? activeBtn : baseBtn}
        >
          Monthly
        </button>
        <button
          role="tab"
          aria-selected={cycle === 'annual'}
          onClick={() => setCycle('annual')}
          style={cycle === 'annual' ? activeBtn : baseBtn}
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
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          background: tokens.surfaces.surface,
          border: `1px solid ${tokens.surfaces.border}`,
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          minWidth: 960,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: tokens.typography.fontSans,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '20px 18px 14px',
                  color: tokens.colors.textMuted,
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  width: LABEL_COL_WIDTH,
                  background: tokens.surfaces.surface,
                }}
              >
                {title}
              </th>
              {TIERS.map((tier) => (
                <th
                  key={tier.slug}
                  style={{
                    textAlign: 'center',
                    padding: '20px 14px 14px',
                    background: tier.highlight ? tokens.surfaces.surfaceTinted : tokens.surfaces.surface,
                    position: 'relative',
                  }}
                >
                  {tier.highlight && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: tokens.colors.accent,
                        color: '#fff',
                        fontFamily: tokens.typography.fontSans,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        padding: '2px 8px',
                        borderRadius: 999,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      MOST POPULAR
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: tokens.typography.fontSans,
                      color: tokens.colors.accent,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginTop: tier.highlight ? 12 : 0,
                    }}
                  >
                    {tier.name}
                  </div>
                </th>
              ))}
            </tr>
            {showPrice ? (
              <tr>
                <th
                  scope="row"
                  style={{
                    textAlign: 'left',
                    padding: '0 18px 20px',
                    color: tokens.colors.textPrimary,
                    fontFamily: tokens.typography.fontSans,
                    fontSize: 13,
                    fontWeight: 600,
                    background: tokens.surfaces.surface,
                    borderBottom: `1px solid ${tokens.surfaces.border}`,
                  }}
                >
                  Price
                </th>
                {TIERS.map((tier) => {
                  const p = tier.prices[cycle];
                  return (
                    <th
                      key={tier.slug}
                      style={{
                        textAlign: 'center',
                        padding: '0 14px 20px',
                        background: tier.highlight ? tokens.surfaces.surfaceTinted : tokens.surfaces.surface,
                        borderBottom: `1px solid ${tokens.surfaces.border}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                        <span
                          style={{
                            fontFamily: tokens.typography.fontSerif,
                            fontWeight: 700,
                            fontSize: 28,
                            color: tokens.colors.textPrimary,
                            lineHeight: 1,
                          }}
                        >
                          {p.display}
                        </span>
                        {p.period && (
                          <span
                            style={{
                              fontFamily: tokens.typography.fontSans,
                              fontSize: 12,
                              color: tokens.colors.textMuted,
                            }}
                          >
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
                <th
                  style={{
                    padding: '0 18px 12px',
                    background: tokens.surfaces.surface,
                    borderBottom: `1px solid ${tokens.surfaces.border}`,
                  }}
                />
                {TIERS.map((tier) => (
                  <th
                    key={tier.slug}
                    style={{
                      padding: '0 14px 12px',
                      background: tier.highlight ? tokens.surfaces.surfaceTinted : tokens.surfaces.surface,
                      borderBottom: `1px solid ${tokens.surfaces.border}`,
                    }}
                  />
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.feature}
                style={{
                  borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${tokens.surfaces.border}`,
                }}
              >
                <td
                  style={{
                    padding: '14px 18px',
                    color: tokens.colors.textPrimary,
                    fontFamily: tokens.typography.fontSans,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {row.feature}
                </td>
                {TIERS.map((tier) => (
                  <td
                    key={tier.slug}
                    style={{
                      padding: '14px 14px',
                      textAlign: 'center',
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 13,
                      background: tier.highlight ? tokens.surfaces.surfaceTinted : 'transparent',
                    }}
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
      style={{
        minWidth: 960,
        margin: '24px 0 0',
        display: 'grid',
        gridTemplateColumns: `${LABEL_COL_WIDTH} repeat(${TIERS.length}, 1fr)`,
        gap: 0,
        alignItems: 'start',
      }}
    >
      <div />
      {TIERS.map((tier) => (
        <div
          key={tier.slug}
          style={{
            padding: '0 14px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: 220 }}>
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
    <section
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '32px 24px',
      }}
      aria-label="Pricing comparison"
    >
      <BillingToggle cycle={cycle} setCycle={setCycle} discountPct={discountPct} />

      <SectionTable title="Licensing" rows={LICENSING_ROWS} cycle={cycle} showPrice />
      <div style={{ overflowX: 'auto' }}>
        <CtaStrip cycle={cycle} />
      </div>

      <div style={{ height: 56 }} />

      <SectionTable title="What's in the box" rows={FEATURE_ROWS} cycle={cycle} showPrice={false} />
      <div style={{ overflowX: 'auto' }}>
        <CtaStrip cycle={cycle} />
      </div>
    </section>
  );
}
