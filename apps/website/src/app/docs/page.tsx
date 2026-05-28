import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { docsConfig } from '../../lib/docs-config';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Documentation — Threadplane',
  description: 'Learn the framework. Library guides, API reference, and production patterns for Threadplane.',
  pathname: '/docs',
  type: 'website',
});

interface PopularTopic {
  title: string;
  description: string;
  href: string;
}

const POPULAR_TOPICS: PopularTopic[] = [
  {
    title: 'Streaming with signals',
    description: 'Token-level streaming wired into Angular signals. The defining @threadplane/langgraph capability.',
    href: '/docs/langgraph/api/agent',
  },
  {
    title: 'Generative UI fundamentals',
    description: 'Server-emitted JSON specs render into Angular components you already own.',
    href: '/docs/render/getting-started/introduction',
  },
  {
    title: 'Production patterns',
    description: 'Deploy paths, error boundaries, and observability for shipping Angular agents.',
    href: '/docs/langgraph/guides/deployment',
  },
];

export default function DocsLandingPage() {
  return (
    <>
      {/* Header */}
      <Section surface="canvas" ariaLabelledBy="docs-heading">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Documentation</Eyebrow>
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
              Learn the framework.
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
              Threadplane is a suite of MIT-licensed libraries for building AI agent interfaces. Pick a library to get started.
            </p>
          </div>
        </Container>
      </Section>

      {/* Library grid */}
      <Section surface="canvas" tight ariaLabelledBy="library-grid-heading">
        <Container>
          <h2
            id="library-grid-heading"
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
            Libraries
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {docsConfig.map((lib) => (
              <Link
                key={lib.id}
                href={`/docs/${lib.id}/getting-started/introduction`}
                style={{ textDecoration: 'none' }}
              >
                <Card padding="lg" hoverable style={{ height: '100%' }}>
                  <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{lib.title}</Eyebrow>
                  <p
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                      margin: 0,
                      marginBottom: 16,
                    }}
                  >
                    {lib.description}
                  </p>
                  <span
                    style={{
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: tokens.colors.accent,
                    }}
                  >
                    Get started →
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {/* Popular topics */}
      <Section surface="canvas" tight ariaLabelledBy="popular-heading">
        <Container>
          <h2
            id="popular-heading"
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
            Popular topics
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
            }}
          >
            {POPULAR_TOPICS.map((t) => (
              <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable style={{ height: '100%' }}>
                  <h3
                    style={{
                      fontFamily: tokens.typography.h3.family,
                      fontSize: 18,
                      lineHeight: 1.3,
                      fontWeight: 600,
                      color: tokens.colors.textPrimary,
                      margin: 0,
                      marginBottom: 8,
                    }}
                  >
                    {t.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                      margin: 0,
                    }}
                  >
                    {t.description}
                  </p>
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
