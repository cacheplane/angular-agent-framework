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
  indie: {
    cta: 'Buy Indie',
    ctaId: 'pricing_tier_indie',
    stripeBuyable: true,
  },
  developer_seat: {
    cta: 'Get Developer Seat',
    ctaId: 'pricing_tier_developer_seat',
    stripeBuyable: true,
  },
  app_deployment: {
    cta: 'License an App',
    ctaId: 'pricing_tier_app_deployment',
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

const FEATURES: FeatureRow[] = [
  {
    feature: 'License',
    cells: {
      community: 'PolyForm Noncommercial 1.0.0',
      indie: 'ThreadPlane Commercial',
      developer_seat: 'ThreadPlane Commercial',
      app_deployment: 'ThreadPlane Commercial',
      enterprise: 'ThreadPlane Commercial + custom',
    },
  },
  {
    feature: 'Commercial production use',
    cells: { community: false, indie: true, developer_seat: true, app_deployment: true, enterprise: true },
  },
  {
    feature: 'Developers',
    cells: {
      community: 'Unlimited (noncommercial)',
      indie: '1',
      developer_seat: 'Per seat',
      app_deployment: 'Unlimited',
      enterprise: 'Unlimited',
    },
  },
  {
    feature: 'Commercial apps',
    cells: {
      community: '—',
      indie: '1',
      developer_seat: 'Unlimited (org-owned)',
      app_deployment: '1',
      enterprise: 'Multi-app',
    },
  },
  {
    feature: 'End users',
    cells: { community: 'Unlimited', indie: 'Unlimited', developer_seat: 'Unlimited', app_deployment: 'Unlimited', enterprise: 'Unlimited' },
  },
  {
    feature: 'Dev · staging · prod',
    cells: { community: false, indie: true, developer_seat: true, app_deployment: true, enterprise: true },
  },
  {
    feature: '30-day commercial eval',
    cells: { community: true, indie: false, developer_seat: false, app_deployment: false, enterprise: false },
  },
  {
    feature: 'Support',
    cells: { community: 'Community', indie: 'Email', developer_seat: 'Email', app_deployment: 'Email', enterprise: 'Priority + private channel' },
  },
  {
    feature: 'SLA',
    cells: { community: false, indie: false, developer_seat: false, app_deployment: false, enterprise: true },
  },
  {
    feature: 'Security review',
    cells: { community: false, indie: false, developer_seat: false, app_deployment: false, enterprise: true },
  },
  {
    feature: 'Pilot-to-Prod engagement',
    cells: { community: false, indie: false, developer_seat: false, app_deployment: false, enterprise: 'Optional' },
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
                    width: '22%',
                    background: tokens.surfaces.surface,
                  }}
                >
                  Plan
                </th>
                {TIERS.map((tier) => {
                  const isHighlight = tier.highlight;
                  return (
                    <th
                      key={tier.slug}
                      style={{
                        textAlign: 'center',
                        padding: '20px 14px 14px',
                        background: isHighlight ? tokens.surfaces.surfaceTinted : tokens.surfaces.surface,
                        borderBottom: 'none',
                        position: 'relative',
                      }}
                    >
                      {isHighlight && (
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
                          marginTop: isHighlight ? 12 : 0,
                        }}
                      >
                        {tier.name}
                      </div>
                    </th>
                  );
                })}
              </tr>
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
            </thead>
            <tbody>
              {FEATURES.map((row, i) => (
                <tr
                  key={row.feature}
                  style={{
                    borderBottom: i === FEATURES.length - 1 ? 'none' : `1px solid ${tokens.surfaces.border}`,
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
            <tfoot>
              <tr>
                <td style={{ padding: '20px 18px', background: tokens.surfaces.surface }} />
                {TIERS.map((tier) => (
                  <td
                    key={tier.slug}
                    style={{
                      padding: '20px 14px',
                      textAlign: 'center',
                      background: tier.highlight ? tokens.surfaces.surfaceTinted : tokens.surfaces.surface,
                      borderTop: `1px solid ${tokens.surfaces.border}`,
                    }}
                  >
                    <PlanButton tier={tier} />
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p
        style={{
          textAlign: 'center',
          fontFamily: tokens.typography.fontSans,
          fontSize: 12,
          color: tokens.colors.textMuted,
          marginTop: 24,
          marginBottom: 0,
        }}
      >
        All paid tiers include the ThreadPlane Commercial license · One-time annual payment · 12-month validity
      </p>
    </section>
  );
}
