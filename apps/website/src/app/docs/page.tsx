import type { ReactNode } from 'react';
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { CopyButton } from '../../components/docs/CopyButton';
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
  logoSrc: string;
  attribution: string;
}

const BACKENDS: Backend[] = [
  {
    title: 'LangGraph',
    blurb: 'For LangChain & LangGraph backends.',
    install: 'npm i @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked',
    href: '/docs/langgraph/getting-started/quickstart',
    logoSrc: '/logos/langgraph.svg',
    attribution: 'LangChain',
  },
  {
    title: 'AG-UI',
    blurb: 'For CrewAI, Mastra, Pydantic AI, Strands, and more.',
    install: 'npm i @threadplane/chat @threadplane/ag-ui @ag-ui/client @ag-ui/core',
    href: '/docs/ag-ui/getting-started/quickstart',
    logoSrc: '/logos/runtimes/copilotkit.svg',
    attribution: 'AG-UI · CopilotKit',
  },
];

interface GenerativeUi {
  title: string;
  blurb: string;
  href: string;
  logoSrc: string;
  attribution: string;
}

const GENERATIVE_UI: GenerativeUi[] = [
  {
    title: 'A2UI',
    blurb:
      'Agent-to-UI protocol — the agent streams and updates surfaces over the conversation.',
    href: '/docs/a2ui/getting-started/introduction',
    logoSrc: '/logos/providers/google.svg',
    attribution: 'Google',
  },
  {
    title: 'json-render',
    blurb:
      'Render a fixed JSON spec into your own Angular components. You own the schema.',
    href: '/docs/render/getting-started/introduction',
    logoSrc: '/logos/surface/vercel.svg',
    attribution: 'Vercel',
  },
];

interface SupportingLib {
  title: string;
  blurb: string;
  href: string;
  glyph: 'key' | 'middleware' | 'pulse';
}

const SUPPORTING: SupportingLib[] = [
  {
    title: 'Middleware',
    blurb: 'Backend client-tool routing',
    href: '/docs/middleware/getting-started/introduction',
    glyph: 'middleware',
  },
  {
    title: 'Licensing',
    blurb: 'Token verification',
    href: '/docs/licensing/getting-started/introduction',
    glyph: 'key',
  },
  {
    title: 'Telemetry',
    blurb: 'Browser & Node events',
    href: '/docs/telemetry/getting-started/introduction',
    glyph: 'pulse',
  },
];

function ChatGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}

function KeyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="12" r="3" />
      <path d="M11 12h9M17 12v4" />
    </svg>
  );
}

function PulseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

function MiddlewareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M4 17h16" />
      <path d="M7 4v6M17 14v6" />
    </svg>
  );
}

const GLYPHS = { key: KeyGlyph, middleware: MiddlewareGlyph, pulse: PulseGlyph } as const;

const stepLabelStyle = {
  fontFamily: tokens.typography.eyebrow.family,
  fontSize: tokens.typography.eyebrow.size,
  fontWeight: tokens.typography.eyebrow.weight,
  letterSpacing: tokens.typography.eyebrow.letterSpacing,
  textTransform: tokens.typography.eyebrow.transform,
  lineHeight: tokens.typography.eyebrow.line,
  color: tokens.colors.textMuted,
  margin: 0,
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
} as const;

const stepBadgeStyle = {
  width: 20,
  height: 20,
  borderRadius: tokens.radius.full,
  background: tokens.colors.accent,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

function StepLabel({ id, step, children }: { id: string; step?: number; children: ReactNode }) {
  return (
    <h2 id={id} style={stepLabelStyle}>
      {step != null ? (
        <span aria-hidden="true" style={stepBadgeStyle}>{step}</span>
      ) : null}
      {children}
    </h2>
  );
}

const logoChipStyle = {
  width: 30,
  height: 30,
  borderRadius: tokens.radius.md,
  background: tokens.surfaces.surface,
  border: `1px solid ${tokens.surfaces.border}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

const glyphChipStyle = {
  borderRadius: tokens.radius.md,
  background: tokens.colors.accentSurface,
  border: `1px solid ${tokens.colors.accentBorder}`,
  color: tokens.colors.accent,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

function LogoChip({ src }: { src: string }) {
  return (
    <span style={logoChipStyle}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        style={{ width: 18, height: 18, objectFit: 'contain' }}
      />
    </span>
  );
}

function GlyphChip({ size, children }: { size: number; children: ReactNode }) {
  return <span style={{ ...glyphChipStyle, width: size, height: size }}>{children}</span>;
}

const cardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
} as const;

const cardTitleStyle = {
  fontFamily: tokens.typography.h3.family,
  fontSize: 18,
  lineHeight: 1.3,
  fontWeight: 600,
  color: tokens.colors.textPrimary,
  margin: 0,
} as const;

const attributionStyle = {
  fontFamily: tokens.typography.fontMono,
  fontSize: 10,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: tokens.colors.textMuted,
  marginTop: 2,
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

const snippetRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  background: tokens.surfaces.surface,
  border: `1px solid ${tokens.surfaces.border}`,
  borderRadius: tokens.radius.md,
  padding: '5px 6px 5px 12px',
  margin: '14px 0 16px',
} as const;

const snippetCodeStyle = {
  fontFamily: tokens.typography.fontMono,
  fontSize: 13,
  color: tokens.colors.textSecondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
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

const fillHeightStyle = {
  height: '100%',
} as const;

const dividerStyle = {
  height: 1,
  background: tokens.surfaces.border,
  border: 'none',
  margin: '0 0 40px',
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
              Start building with Threadplane
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
              Streaming agent interfaces with runtime adapters, a shared Agent contract,
              and a drop-in chat surface. Most packages are MIT; @threadplane/chat is
              dual-licensed for noncommercial/evaluation and commercial production use.
            </p>
          </div>
        </Container>
      </Section>

      {/* Step 1 — backend */}
      <Section surface="canvas" tight ariaLabelledBy="backend-heading">
        <Container>
          <StepLabel id="backend-heading" step={1}>Pick your backend</StepLabel>
          <div style={gridStyle}>
            {BACKENDS.map((b) => (
              <Link key={b.href} href={b.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable accent style={fillHeightStyle}>
                  <div style={cardHeaderStyle}>
                    <LogoChip src={b.logoSrc} />
                    <div>
                      <h3 style={cardTitleStyle}>{b.title}</h3>
                      <div style={attributionStyle}>{b.attribution}</div>
                    </div>
                  </div>
                  <p style={cardBlurbStyle}>{b.blurb}</p>
                  <div style={snippetRowStyle}>
                    <code style={snippetCodeStyle}>{b.install}</code>
                    <CopyButton text={b.install} />
                  </div>
                  <span style={ctaStyle}>Adapter quickstart →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Not sure which to use?{' '}
            <Link href="/docs/choosing-an-adapter" style={helperLinkStyle}>
              Choosing an adapter →
            </Link>
            {' '}Want the drop-in UI first?{' '}
            <Link href="/docs/chat/getting-started/quickstart" style={helperLinkStyle}>
              Chat quickstart →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 2 — generative UI */}
      <Section surface="canvas" tight ariaLabelledBy="genui-heading">
        <Container>
          <div style={dividerStyle} />
          <StepLabel id="genui-heading" step={2}>Generative UI</StepLabel>
          <div style={gridStyle}>
            {GENERATIVE_UI.map((g) => (
              <Link key={g.href} href={g.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable accent style={fillHeightStyle}>
                  <div style={cardHeaderStyle}>
                    <LogoChip src={g.logoSrc} />
                    <div>
                      <h3 style={cardTitleStyle}>{g.title}</h3>
                      <div style={attributionStyle}>{g.attribution}</div>
                    </div>
                  </div>
                  <p style={cardBlurbStyle}>{g.blurb}</p>
                  <span style={{ ...ctaStyle, display: 'inline-block', marginTop: 14 }}>Get started →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Which fits my use case?{' '}
            <Link href="/docs/render/concepts/json-render-vs-a2ui" style={helperLinkStyle}>
              json-render vs A2UI →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 3 — chat */}
      <Section surface="canvas" tight ariaLabelledBy="chat-heading">
        <Container>
          <div style={dividerStyle} />
          <StepLabel id="chat-heading" step={3}>Chat UI</StepLabel>
          <Link href="/docs/chat/getting-started/introduction" style={{ textDecoration: 'none' }}>
            <Card padding="lg" hoverable style={fillHeightStyle}>
              <div style={cardHeaderStyle}>
                <GlyphChip size={30}><ChatGlyph /></GlyphChip>
                <div>
                  <h3 style={cardTitleStyle}>Chat</h3>
                  <div style={attributionStyle}>Threadplane</div>
                </div>
              </div>
              <p style={cardBlurbStyle}>
                Drop-in chat components — message list, input, streaming, tool
                calls, interrupts, subagents. Renders A2UI & json-render surfaces
                inline.
              </p>
            </Card>
          </Link>
        </Container>
      </Section>

      {/* Supporting libraries */}
      <Section surface="canvas" tight ariaLabelledBy="supporting-heading">
        <Container>
          <div style={dividerStyle} />
          <StepLabel id="supporting-heading">Supporting libraries</StepLabel>
          <div style={gridStyle}>
            {SUPPORTING.map((s) => {
              const Glyph = GLYPHS[s.glyph];
              return (
                <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
                  <Card padding="lg" hoverable style={fillHeightStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <GlyphChip size={26}><Glyph /></GlyphChip>
                      <div>
                        <h3 style={{ ...cardTitleStyle, fontSize: 16 }}>{s.title}</h3>
                        <p style={{ ...cardBlurbStyle, fontSize: 13, marginTop: 2 }}>{s.blurb}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
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
