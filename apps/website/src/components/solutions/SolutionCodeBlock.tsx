import { codeToHtml } from 'shiki';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import type { SolutionCode, SolutionCodeBlocks } from '../../lib/solutions-data';

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
async function highlight(block: SolutionCode) {
  return codeToHtml(block.source, { lang: block.language, theme: 'tokyo-night' });
}

export async function SolutionCodeBlock({ code }: { code: SolutionCodeBlocks }) {
  // Highlight every block up front: an async map inside JSX would give React
  // promises to render rather than markup.
  const rendered = await Promise.all(
    code.map(async (block) => ({ ...block, html: await highlight(block) })),
  );

  return (
    <Section surface="canvas" ariaLabelledBy="solution-code-heading">
      <Container>
        <div className="sol-code-wrap">
          <Eyebrow tone="accent" className="sol-code-eyebrow">In practice</Eyebrow>
          <h2 id="solution-code-heading" className="sol-code-heading">
            What it looks like in your codebase
          </h2>
          {rendered.map((block, index) => (
            <div
              key={block.label}
              className="sol-code-block-item"
              data-first={index === 0 || undefined}
            >
              <p className="sol-code-block-label">
                {block.label}
              </p>
          {/*
            Shiki emits a <pre> carrying its own background; its padding and
            `overflow-x: auto` come from the `pre.shiki` / `pre` rules in
            global.css, so this wrapper owns only the frame.
            `overflow: hidden` is what makes the radius clip that background — it
            must not be `auto`, which would nest a second scroll container around
            a element that already scrolls and can show two scrollbars.
          */}
              <div
                className="solution-code"
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
