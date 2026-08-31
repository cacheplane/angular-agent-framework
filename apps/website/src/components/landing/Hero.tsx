'use client';

import React, { useCallback, useState } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Pill } from '../ui/Pill';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';
import { HERO_CHIPS, POSITIONING_PROOF_POINTS } from '../../lib/positioning';

const INSTALL_COMMAND = 'npm install @threadplane/chat @threadplane/langgraph';
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
      {copied ? 'Copied ✓' : 'Install LangGraph starter'}
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
        <div className="hero-grid">
          {/* Left column */}
          <div>
            <Eyebrow tone="accent" className="hero-eyebrow">
              Threadplane · Angular agent UI
            </Eyebrow>
            <h1 id="hero-heading" className="hero-heading">
              Ship production agent UIs in Angular.
            </h1>
            <p className="hero-subhead">
              The streaming demo takes an afternoon.{' '}
              <span className="marker-highlight">
                Everything after it takes six months.
              </span>{' '}
              Threadplane is the Angular layer that closes the gap — and it{' '}
              <span className="marker-highlight">
                keeps your backend exactly where it is.
              </span>
            </p>
            <ul className="hero-chip-row" aria-label="Capabilities">
              {HERO_CHIPS.map((chip) => (
                <li key={chip} className="hero-chip">
                  {chip}
                </li>
              ))}
            </ul>
            <div className="hero-cta-row">
              <PrimaryInstallButton />
              <SecondaryTalkButton />
            </div>
            <div className="hero-proof-row">
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
                  className="hero-proof-link"
                >
                  <Pill variant={index === 0 ? 'accent' : 'neutral'} className="hero-proof-pill">
                    {proofPoint.label}
                  </Pill>
                </a>
              ))}
            </div>
            <p className="hero-caption">
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
              className="hero-demo-link"
              aria-label="Open the generative UI example running in cockpit"
            >
              <BrowserFrame
                url="demo.threadplane.ai"
                rotate={-1}
                elevation="lg"
                className="hero-demo-frame"
              >
                <img
                  src="/screenshots/canonical-demo-generative-ui.webp"
                  alt="Canonical demo — agent renders a live airline operations dashboard with KPI cards, charts, and a disruptions table"
                  className="hero-demo-img"
                  loading="lazy"
                  decoding="async"
                />
              </BrowserFrame>
            </a>
            <p className="hero-demo-caption">
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
                className="hero-demo-caption-link"
              >
                Open in cockpit →
              </a>
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
