// SPDX-License-Identifier: MIT
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { JsonLd } from '../../components/shared/JsonLd';
import { aboutPageJsonLd, REPOSITORY_URL } from '../../lib/structured-data';
import { getAuthor } from '../../lib/blog-authors';
import { createPageMetadata } from '../../lib/site-metadata';
import { LONG_SUBHEAD } from '../../lib/positioning';
import {
  ABOUT_HISTORY,
  ABOUT_HISTORY_HEADING,
  ABOUT_INTRO,
  ABOUT_PERSONAL,
  ABOUT_PRINCIPLES,
} from '../../lib/about-content';

/**
 * The single author record the site already publishes (blog bylines read the
 * same object), so the Person node and every BlogPosting byline state one name
 * and one role rather than two that happen to agree.
 */
const author = getAuthor('brian');

export const metadata = createPageMetadata({
  title: 'About — Threadplane',
  description: `Who writes Threadplane: ${author.name}, ${author.role}. ${author.bio}`,
  pathname: '/about',
  type: 'website',
});

const bodyStyle = {
  fontFamily: tokens.typography.bodyLg.family,
  fontSize: tokens.typography.bodyLg.size,
  lineHeight: tokens.typography.bodyLg.line,
  color: tokens.colors.textSecondary,
  margin: 0,
  marginBottom: 16,
  maxWidth: '60ch',
} as const;

const headingStyle = {
  fontFamily: tokens.typography.h2.family,
  fontSize: tokens.typography.h2.size,
  color: tokens.colors.textPrimary,
  margin: 0,
  marginBottom: 12,
} as const;

const linkStyle = { color: tokens.colors.accent } as const;

export default function AboutPage() {
  return (
    <>
      <JsonLd data={aboutPageJsonLd(author)} />

      <Section surface="canvas" ariaLabelledBy="about-heading">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>About</Eyebrow>
            <h1
              id="about-heading"
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
              Who writes Threadplane
            </h1>
            <p style={bodyStyle}>{ABOUT_INTRO}</p>

            <h2 style={{ ...headingStyle, marginTop: 32 }}>{ABOUT_HISTORY_HEADING}</h2>
            {ABOUT_HISTORY.map((paragraph) => (
              <p key={paragraph} style={bodyStyle}>
                {paragraph}
              </p>
            ))}

            <p style={bodyStyle}>{ABOUT_PRINCIPLES}</p>
            <p style={bodyStyle}>{ABOUT_PERSONAL}</p>

            <p style={{ ...bodyStyle, marginBottom: 0 }}>
              <a
                href={`https://github.com/${author.github}`}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                github.com/{author.github}
              </a>
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="tinted">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <h2 style={headingStyle}>What Threadplane is</h2>
            <p style={bodyStyle}>{LONG_SUBHEAD}</p>
            <p style={{ ...bodyStyle, marginBottom: 0 }}>
              The source is public at{' '}
              <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                github.com/cacheplane/angular-agent-framework
              </a>
              .
            </p>
          </div>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <h2 style={headingStyle}>How it is licensed</h2>
            <p style={bodyStyle}>
              <code>@threadplane/chat</code> is free for noncommercial use under PolyForm
              Noncommercial 1.0.0; commercial production use requires a Threadplane Commercial
              license. The other libraries are MIT. The{' '}
              <Link href="/docs/licensing" style={linkStyle}>
                licensing docs
              </Link>{' '}
              and the <Link href="/pricing" style={linkStyle}>pricing page</Link> have the details.
            </p>
            <p style={{ ...bodyStyle, marginBottom: 0 }}>
              Questions about a specific build go to{' '}
              <Link href="/contact" style={linkStyle}>
                contact
              </Link>
              ; ongoing writing is on the <Link href="/blog" style={linkStyle}>blog</Link>.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
