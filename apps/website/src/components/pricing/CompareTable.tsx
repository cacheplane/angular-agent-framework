'use client';

import { tokens } from '@ngaf/design-tokens';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import type { CtaId } from '../../lib/analytics/events';
import { TIERS, type TierConfig } from '../../../../../pricing/tiers.config';

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
  {
    feature: 'Headless chat primitives',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Durable threads',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Interrupts (human-in-the-loop)',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Subagents + delegation',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Planning + memory',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Generative UI (json-render + A2UI)',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Signal-based streaming',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Citations + sources panel',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'LangGraph + AG-UI adapters',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
  {
    feature: 'Theme presets (light/dark, Material 3)',
    cells: { community: true, developer_seat: true, team: true, enterprise: true },
  },
];

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

function PlanButton({ tier }: { tier: TierConfig }) {
  const cta = CTAS[tier.slug];
  const variant = tier.highlight ? 'primary' : 'secondary';
  const common = {
    variant,
    size: 'md' as const,
    style: { width: '100%' },
  };
  if (cta.stripeBuyable) {
    return (
      <form action="/api/checkout/session" method="post">
        <input type="hidden" name="tier" value={tier.slug} />
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

function SectionTable({ title, rows, showPrice }: { title: string; rows: FeatureRow[]; showPrice: boolean }) {
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
            {showPrice && (
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
                {TIERS.map((tier) => (
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
                        {tier.displayPrice}
                      </span>
                      {tier.displayPeriod && (
                        <span
                          style={{
                            fontFamily: tokens.typography.fontSans,
                            fontSize: 12,
                            color: tokens.colors.textMuted,
                          }}
                        >
                          {tier.displayPeriod}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            )}
            {!showPrice && (
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

function CtaStrip() {
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
            <PlanButton tier={tier} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CompareTable() {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '32px 24px',
      }}
      aria-label="Pricing comparison"
    >
      <SectionTable title="Licensing" rows={LICENSING_ROWS} showPrice />
      <div style={{ overflowX: 'auto' }}>
        <CtaStrip />
      </div>

      <div style={{ height: 56 }} />

      <SectionTable title="What's in the box" rows={FEATURE_ROWS} showPrice={false} />
      <div style={{ overflowX: 'auto' }}>
        <CtaStrip />
      </div>
    </section>
  );
}
