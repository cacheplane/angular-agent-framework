'use client';

import React, { useCallback, useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Pill } from '../ui/Pill';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';
import { HERO_SUBHEAD, POSITIONING_PROOF_POINTS } from '../../lib/positioning';

const INSTALL_COMMAND = 'npm install @threadplane/chat';
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
      {copied ? 'Copied ✓' : 'Install @threadplane/chat'}
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
              Threadplane · MIT framework
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
                <a
                  key={proofPoint.label}
                  href={proofPoint.href}
                  onClick={() =>
                    track(analyticsEvents.marketingCtaClick, {
                      cta_id: 'hero_proof_pill',
                      track: 'developer',
                      surface: 'home',
                    })
                  }
                  style={{ textDecoration: 'none' }}
                >
                  <Pill variant={index === 0 ? 'accent' : 'neutral'} className="hero-proof-pill">
                    {proofPoint.label}
                  </Pill>
                </a>
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
              Not another backend agent runtime. Keep LangGraph, Genkit, Mastra, CrewAI, or your own service. Threadplane solves the Angular UI layer.
            </p>
          </div>

          {/* Right column — generative UI dashboard */}
          <div>
            <a
              href="https://cockpit.threadplane.ai/langgraph/core-capabilities/streaming/overview/python"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track(analyticsEvents.marketingCtaClick, {
                  cta_id: 'hero_demo_open_cockpit',
                  track: 'developer',
                  surface: 'home',
                })
              }
              style={{ display: 'block', textDecoration: 'none' }}
              aria-label="Open the generative UI example running in cockpit"
            >
              <BrowserFrame
                url="demo.threadplane.ai"
                rotate={-1}
                elevation="lg"
                style={{ width: '100%' }}
              >
                <img
                  src="/screenshots/canonical-demo-generative-ui.webp"
                  alt="Canonical demo — agent renders a live airline operations dashboard with KPI cards, charts, and a disruptions table"
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                  loading="lazy"
                  decoding="async"
                />
              </BrowserFrame>
            </a>
            <p
              style={{
                margin: '12px 0 0',
                textAlign: 'center',
                fontFamily: tokens.typography.body.family,
                fontSize: 13,
                color: tokens.colors.textMuted,
              }}
            >
              <a
                href="https://cockpit.threadplane.ai/langgraph/core-capabilities/streaming/overview/python"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track(analyticsEvents.marketingCtaClick, {
                    cta_id: 'hero_demo_open_cockpit_caption',
                    track: 'developer',
                    surface: 'home',
                  })
                }
                style={{ color: tokens.colors.accent, textDecoration: 'none', fontWeight: 600 }}
              >
                Open in cockpit →
              </a>
            </p>
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
          .hero-proof-pill {
            transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
            will-change: transform;
          }
          a:hover > .hero-proof-pill,
          a:focus-visible > .hero-proof-pill {
            transform: translateY(-1px);
            background: ${tokens.colors.accentSurface} !important;
            border-color: ${tokens.colors.accentBorder} !important;
            color: ${tokens.colors.accent} !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          }
          a:active > .hero-proof-pill {
            transform: translateY(0);
            box-shadow: none;
          }
          @media (prefers-reduced-motion: reduce) {
            .hero-proof-pill { transition: none; }
            a:hover > .hero-proof-pill,
            a:focus-visible > .hero-proof-pill { transform: none; }
          }
        `}</style>
      </Container>
    </Section>
  );
}
