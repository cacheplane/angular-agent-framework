import type { ReactNode } from 'react';
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Documentation — Threadplane',
  description:
    'Build AI agent UIs in Angular. Library guides, API reference, and production patterns for Threadplane.',
  pathname: '/docs',
  type: 'website',
});

interface Backend {
  title: string;
  blurb: string;
  install: string;
  href: string;
}

const BACKENDS: Backend[] = [
  {
    title: 'LangGraph',
    blurb: 'For LangChain / LangGraph backends',
    install: 'npm i @threadplane/langgraph',
    href: '/docs/langgraph/getting-started/quickstart',
  },
  {
    title: 'AG-UI',
    blurb: 'CrewAI, Mastra, Pydantic AI, Strands…',
    install: 'npm i @threadplane/ag-ui',
    href: '/docs/ag-ui/getting-started/quickstart',
  },
];

interface GenerativeUi {
  vendor: string;
  title: string;
  blurb: string;
  href: string;
}

const GENERATIVE_UI: GenerativeUi[] = [
  {
    vendor: 'Google',
    title: 'A2UI',
    blurb:
      'Agent-to-UI protocol — the agent streams and updates surfaces over the conversation.',
    href: '/docs/a2ui/getting-started/introduction',
  },
  {
    vendor: 'Vercel',
    title: 'json-render',
    blurb:
      'Render a fixed JSON spec into your own Angular components. You own the schema.',
    href: '/docs/render/getting-started/introduction',
  },
];

interface SupportingLib {
  title: string;
  blurb: string;
  href: string;
}

const SUPPORTING: SupportingLib[] = [
  {
    title: 'Licensing',
    blurb: 'Token verification',
    href: '/docs/licensing/getting-started/introduction',
  },
  {
    title: 'Telemetry',
    blurb: 'Browser & Node events',
    href: '/docs/telemetry/getting-started/introduction',
  },
];

function StepLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      style={{
        fontFamily: tokens.typography.eyebrow.family,
        fontSize: tokens.typography.eyebrow.size,
        fontWeight: tokens.typography.eyebrow.weight,
        letterSpacing: tokens.typography.eyebrow.letterSpacing,
        textTransform: tokens.typography.eyebrow.transform,
        lineHeight: tokens.typography.eyebrow.line,
        color: tokens.colors.textMuted,
        margin: 0,
        marginBottom: 16,
      }}
    >
      {children}
    </h2>
  );
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
} as const;

const cardTitleStyle = {
  fontFamily: tokens.typography.h3.family,
  fontSize: 18,
  lineHeight: 1.3,
  fontWeight: 600,
  color: tokens.colors.textPrimary,
  margin: 0,
  marginBottom: 8,
} as const;

const cardBlurbStyle = {
  fontFamily: tokens.typography.body.family,
  fontSize: tokens.typography.body.size,
  lineHeight: tokens.typography.body.line,
  color: tokens.colors.textSecondary,
  margin: 0,
} as const;

const ctaStyle = {
  fontFamily: tokens.typography.fontSans,
  fontSize: 14,
  fontWeight: 600,
  color: tokens.colors.accent,
} as const;

const helperStyle = {
  fontFamily: tokens.typography.body.family,
  fontSize: 14,
  color: tokens.colors.textSecondary,
  margin: 0,
  marginTop: 16,
  textAlign: 'center',
} as const;

const helperLinkStyle = {
  color: tokens.colors.accent,
  fontWeight: 600,
} as const;

const accentCardStyle = {
  height: '100%',
  background: tokens.colors.accentSurface,
  border: `1px solid ${tokens.colors.accentBorder}`,
} as const;

const supportingTitleStyle = {
  ...cardTitleStyle,
  fontSize: 16,
  marginBottom: 4,
} as const;

export default function DocsLandingPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="docs-heading">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Documentation
            </Eyebrow>
            <h1
              id="docs-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}
            >
              Build AI agent UIs in Angular
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                maxWidth: '52ch',
              }}
            >
              A suite of MIT-licensed libraries for streaming agent interfaces.
              Pick your backend to get started.
            </p>
          </div>
        </Container>
      </Section>

      {/* Step 1 — backend */}
      <Section surface="canvas" tight ariaLabelledBy="backend-heading">
        <Container>
          <StepLabel id="backend-heading">Step 1 · Pick your backend</StepLabel>
          <div style={gridStyle}>
            {BACKENDS.map((b) => (
              <Link key={b.href} href={b.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable style={accentCardStyle}>
                  <h3 style={cardTitleStyle}>{b.title}</h3>
                  <p style={{ ...cardBlurbStyle, marginBottom: 16 }}>{b.blurb}</p>
                  <code
                    style={{
                      display: 'block',
                      fontFamily: tokens.typography.fontMono,
                      fontSize: 13,
                      color: tokens.colors.textSecondary,
                      background: tokens.surfaces.surfaceDim,
                      border: `1px solid ${tokens.surfaces.border}`,
                      borderRadius: tokens.radius.md,
                      padding: '8px 12px',
                      marginBottom: 16,
                    }}
                  >
                    {b.install}
                  </code>
                  <span style={ctaStyle}>Quickstart →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Not sure which to use?{' '}
            <Link href="/docs/choosing-an-adapter" style={helperLinkStyle}>
              Choosing an adapter →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 2 — generative UI */}
      <Section surface="canvas" tight ariaLabelledBy="genui-heading">
        <Container>
          <StepLabel id="genui-heading">Step 2 · Generative UI</StepLabel>
          <div style={gridStyle}>
            {GENERATIVE_UI.map((g) => (
              <Link key={g.href} href={g.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable style={accentCardStyle}>
                  <Eyebrow tone="accent" style={{ marginBottom: 8 }}>
                    {g.vendor}
                  </Eyebrow>
                  <h3 style={cardTitleStyle}>{g.title}</h3>
                  <p style={{ ...cardBlurbStyle, marginBottom: 16 }}>{g.blurb}</p>
                  <span style={ctaStyle}>Get started →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Which fits my use case?{' '}
            <Link
              href="/docs/render/concepts/json-render-vs-a2ui"
              style={helperLinkStyle}
            >
              json-render vs A2UI →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 3 — chat */}
      <Section surface="canvas" tight ariaLabelledBy="chat-heading">
        <Container>
          <StepLabel id="chat-heading">Step 3 · Chat UI</StepLabel>
          <Link
            href="/docs/chat/getting-started/introduction"
            style={{ textDecoration: 'none' }}
          >
            <Card padding="lg" hoverable>
              <h3 style={cardTitleStyle}>Chat</h3>
              <p style={cardBlurbStyle}>
                Drop-in chat components — message list, input, streaming, tool
                calls, interrupts, subagents. Renders A2UI & json-render
                surfaces inline.
              </p>
            </Card>
          </Link>
        </Container>
      </Section>

      {/* Supporting libraries */}
      <Section surface="canvas" tight ariaLabelledBy="supporting-heading">
        <Container>
          <StepLabel id="supporting-heading">Supporting libraries</StepLabel>
          <div style={gridStyle}>
            {SUPPORTING.map((s) => (
              <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
                <Card hoverable style={{ height: '100%' }}>
                  <h3 style={supportingTitleStyle}>{s.title}</h3>
                  <p style={cardBlurbStyle}>{s.blurb}</p>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {/* Search prompt */}
      <Section surface="tinted" tight ariaLabelledBy="search-prompt-heading">
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <h2
              id="search-prompt-heading"
              style={{
                fontFamily: tokens.typography.h3.family,
                fontSize: 22,
                lineHeight: 1.3,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 12,
              }}
            >
              Looking for something specific?
            </h2>
            <p
              style={{
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Press <Pill variant="neutral">⌘K</Pill> to search the docs.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
