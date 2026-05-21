'use client';

import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';
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
    cta: 'Buy indie license',
    ctaId: 'pricing_tier_indie',
    stripeBuyable: true,
  },
  developer_seat: {
    cta: 'Buy developer seat',
    ctaId: 'pricing_tier_developer_seat',
    stripeBuyable: true,
  },
  app_deployment: {
    cta: 'License an app',
    ctaId: 'pricing_tier_app_deployment',
    stripeBuyable: true,
  },
  enterprise: {
    cta: 'Contact sales',
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          {TIERS.map((tier) => {
            const cta = CTAS[tier.slug];
            return (
              <Card
                key={tier.slug}
                padding="lg"
                surface={tier.highlight ? 'dim' : 'white'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: tier.highlight
                    ? `2px solid ${tokens.colors.accent}`
                    : `1px solid ${tokens.surfaces.border}`,
                }}
              >
                <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{tier.name}</Eyebrow>
                <p
                  style={{
                    fontFamily: tokens.typography.fontSerif,
                    fontWeight: 700,
                    fontSize: 40,
                    color: tokens.colors.textPrimary,
                    lineHeight: 1,
                    marginBottom: 4,
                    marginTop: 0,
                  }}
                >
                  {tier.displayPrice}
                </p>
                <p
                  style={{
                    fontFamily: tokens.typography.body.family,
                    fontSize: 13,
                    color: tokens.colors.textMuted,
                    marginBottom: 16,
                    marginTop: 0,
                  }}
                >
                  {tier.displayPeriod}
                </p>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '0 0 20px 0',
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
                        fontFamily: tokens.typography.body.family,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: tokens.colors.textSecondary,
                        paddingLeft: 16,
                        position: 'relative',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          color: tokens.colors.accent,
                        }}
                      >
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
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
                  >
                    {cta.cta}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
