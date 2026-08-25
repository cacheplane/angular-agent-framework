// SPDX-License-Identifier: MIT
import { codeToHtml } from 'shiki';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import type { SolutionCode } from '../../lib/solutions-data';

/**
 * The `code` block on a solutions page.
 *
 * Highlighted with Shiki directly rather than through `rehype-pretty-code`:
 * that plugin only runs over MDX, and these pages are TSX. The theme matches
 * `MdxRenderer`'s (`tokyo-night`) so a snippet here reads the same as one in
 * the docs.
 *
 * This is an async Server Component, so highlighting happens at build time and
 * ships no Shiki payload to the browser.
 */
export async function SolutionCodeBlock({ code, accent }: { code: SolutionCode; accent: string }) {
  const html = await codeToHtml(code.source, {
    lang: code.language,
    theme: 'tokyo-night',
  });

  return (
    <Section surface="canvas" ariaLabelledBy="solution-code-heading">
      <Container>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <Eyebrow style={{ color: accent, marginBottom: 12 }}>In practice</Eyebrow>
          <h2
            id="solution-code-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 12,
              letterSpacing: '-0.015em',
            }}
          >
            What it looks like in your codebase
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.body.family,
              fontSize: tokens.typography.body.size,
              lineHeight: tokens.typography.body.line,
              color: tokens.colors.textSecondary,
              margin: '0 0 20px',
            }}
          >
            {code.label}
          </p>
          {/*
            Shiki emits a complete <pre> that already carries its own background,
            padding, and `overflow-x: auto`, so this wrapper owns only the frame.
            `overflow: hidden` is what makes the radius clip that background — it
            must not be `auto`, which would nest a second scroll container around
            a element that already scrolls and can show two scrollbars.
          */}
          <div
            className="solution-code"
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${tokens.surfaces.border}`,
              fontSize: 14,
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </Container>
    </Section>
  );
}
