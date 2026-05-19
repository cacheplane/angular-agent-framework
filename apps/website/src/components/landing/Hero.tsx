'use client';

import React, { useCallback, useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Pill } from '../ui/Pill';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';
import { HERO_SUBHEAD, POSITIONING_PROOF_POINTS } from '../../lib/positioning';

const INSTALL_COMMAND = 'npm install @ngaf/chat';
const COPY_FEEDBACK_MS = 1500;

function PrimaryInstallButton() {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    track(analyticsEvents.marketingCtaClick, {
      cta_id: 'hero_install',
      track: 'developer',
      surface: 'home',
    });
    try {
      await navigator.clipboard?.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Silent fail. Event still fires; users can copy from the docs page.
    }
  }, []);

  return (
    <Button variant="primary" size="lg" onClick={onClick}>
      {copied ? 'Copied ✓' : 'Install @ngaf/chat'}
    </Button>
  );
}

function SecondaryTalkButton() {
  const onClick = useCallback(() => {
    track(analyticsEvents.marketingCtaClick, {
      cta_id: 'hero_talk_to_engineers',
      track: 'enterprise',
      surface: 'home',
    });
  }, []);

  return (
    <Button
      variant="ghost"
      size="lg"
      href="/contact?source=home_hero&track=enterprise"
      onClick={onClick}
    >
      Talk to our engineers
    </Button>
  );
}

export function Hero() {
  return (
    <Section surface="canvas" ariaLabelledBy="hero-heading">
      <Container>
        <div
          className="hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
        >
          {/* Left column */}
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Agent UI for Angular · MIT
            </Eyebrow>
            <h1
              id="hero-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 24,
                letterSpacing: '-0.02em',
              }}
            >
              Ship production agent UIs in Angular.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                marginBottom: 32,
                maxWidth: '54ch',
              }}
            >
              {HERO_SUBHEAD}
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <PrimaryInstallButton />
              <SecondaryTalkButton />
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              {POSITIONING_PROOF_POINTS.map((proofPoint, index) => (
                <Pill key={proofPoint} variant={index === 0 ? 'accent' : 'neutral'}>
                  {proofPoint}
                </Pill>
              ))}
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textMuted,
                fontStyle: 'italic',
                maxWidth: '60ch',
              }}
            >
              Not another backend agent runtime. Keep LangGraph, Genkit, Mastra, CrewAI, or your own service. ThreadPlane solves the Angular UI layer.
            </p>
          </div>

          {/* Right column — layered collage (preserved verbatim from prior Hero.tsx) */}
          <div style={{ position: 'relative', minHeight: 420 }} aria-hidden="true">
            <BrowserFrame
              url="demo.threadplane.ai"
              rotate={-3}
              elevation="lg"
              style={{ position: 'absolute', top: 0, left: 0, width: '92%' }}
            >
              <img
                src="/screenshots/canonical-demo-generative-ui.webp"
                alt="Canonical demo — agent renders a live airline operations dashboard with KPI cards, charts, and a disruptions table"
                style={{ display: 'block', width: '100%', height: 'auto' }}
                loading="lazy"
                decoding="async"
              />
            </BrowserFrame>
            <BrowserFrame
              url="agent.signal()"
              rotate={4}
              elevation="md"
              style={{
                position: 'absolute',
                top: 160,
                right: 0,
                width: '70%',
                maxWidth: 320,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  padding: '16px 18px',
                  background: '#1a1b26',
                  color: '#a9b1d6',
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 12,
                  lineHeight: 1.6,
                  overflow: 'hidden',
                }}
              >
{`provideAgent({
  apiUrl: '/agent',
});

const a = agent();
a.messages();
a.status();`}
              </pre>
            </BrowserFrame>
          </div>
        </div>

        <style>{`
          @keyframes blink { to { visibility: hidden; } }
          @media (max-width: 900px) {
            .hero-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
