'use client';

import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import type { CtaId } from '../../lib/analytics/events';
import { TIERS, type TierConfig } from '../../../../../pricing/tiers.config';

interface PlanCta {
  readonly cta: string;
  readonly ctaId: CtaId;
  /** Set for tiers that route to Stripe via a POST form. */
  readonly stripeBuyable?: boolean;
  /** Set for tiers that link directly (community = npm, enterprise = /contact). */
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

export function PricingGrid() {
  return (
    <Section surface="canvas">
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            maxWidth: 1280,
            margin: '0 auto',
            alignItems: 'stretch',
          }}
        >
          {TIERS.map((tier) => {
            const cta = CTAS[tier.slug];
            return (
              <article
                key={tier.slug}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  background: tier.highlight ? tokens.surfaces.surfaceTinted : tokens.surfaces.surface,
                  border: tier.highlight
                    ? `2px solid ${tokens.colors.accent}`
                    : `1px solid ${tokens.surfaces.border}`,
                  borderRadius: tokens.radius.lg,
                  padding: '20px 18px 18px',
                  boxShadow: tier.highlight
                    ? '0 8px 24px rgba(37, 99, 235, 0.12)'
                    : 'none',
                }}
              >
                {tier.highlight && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: tokens.colors.accent,
                      color: '#fff',
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      padding: '4px 12px',
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
                  }}
                >
                  {tier.name}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 4,
                    marginTop: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: tokens.typography.fontSerif,
                      fontWeight: 700,
                      fontSize: 32,
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
                        fontSize: 13,
                        color: tokens.colors.textMuted,
                      }}
                    >
                      {tier.displayPeriod}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontFamily: tokens.typography.fontSans,
                    fontSize: 12,
                    color: tokens.colors.textMuted,
                    marginTop: 4,
                  }}
                >
                  {tier.subtitle}
                </div>

                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '16px 0 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    flex: 1,
                  }}
                >
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      style={{
                        fontFamily: tokens.typography.fontSans,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: tokens.colors.textSecondary,
                        paddingLeft: 18,
                        position: 'relative',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          color: tokens.colors.accent,
                          fontWeight: 700,
                        }}
                      >
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div
                  style={{
                    fontFamily: tokens.typography.fontSans,
                    fontSize: 11,
                    color: tokens.colors.textMuted,
                    paddingTop: 12,
                    marginBottom: 14,
                    borderTop: `1px solid ${tokens.surfaces.border}`,
                  }}
                >
                  Best for: {tier.bestFor}
                </div>

                {cta.stripeBuyable ? (
                  <form action="/api/checkout/session" method="post">
                    <input type="hidden" name="tier" value={tier.slug} />
                    <Button
                      type="submit"
                      variant={tier.highlight ? 'primary' : 'ghost'}
                      size="md"
                      onClick={() =>
                        trackCtaClick({
                          surface: 'pricing',
                          destination_url: '/api/checkout/session',
                          cta_id: cta.ctaId,
                          cta_text: cta.cta,
                        })
                      }
                      style={{ width: '100%' }}
                    >
                      {cta.cta}
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant={tier.highlight ? 'primary' : 'ghost'}
                    size="md"
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
                    style={{ width: '100%' }}
                  >
                    {cta.cta}
                  </Button>
                )}
              </article>
            );
          })}
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
      </Container>
    </Section>
  );
}
