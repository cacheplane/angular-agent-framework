import { stripFrontmatter } from './docs';
import { extractHeadings } from './extract-headings';
import type { DocSection } from './docs-search-types';

export type { DocSection };

/**
 * Fenced code is dropped deliberately: it is roughly half the corpus and
 * mostly noise for ranking. The cost is explicit — an error string that only
 * ever appears inside a code sample will not match. Inline code is kept,
 * because that is where API names appear in sentences.
 */
function toSearchableText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    // Opening component tags, self-closing or paired (e.g. `<StackDiagram caption="..." />`,
    // `<Step title="Install the package">`): keep prose-bearing attributes, drop the tag.
    // Step/Callout titles carry real search content ("Install the package") that would
    // otherwise vanish, since only the children of a paired tag survive below.
    .replace(/<[A-Z][\w.]*(?:\s[^>]*)?\/?>/g, (tag) => {
      const prose = [...tag.matchAll(/\b(?:caption|title)="([^"]*)"/g)].map((m) => m[1]);
      return ` ${prose.join(' ')} `;
    })
    // Closing component tags: drop.
    .replace(/<\/[A-Z][\w.]*>/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a doc body into one record per heading, plus one for the preamble.
 *
 * Anchors come from `extractHeadings` rather than a second slugifier. That
 * file hand-rolls GitHub-style slugification, and having one approximation is
 * a known quantity while two that drift apart is a bug generator.
 */
export function indexDocSections(source: string): DocSection[] {
  const body = stripFrontmatter(source);
  const headings = extractHeadings(body);
  const lines = body.split('\n');

  const sections: DocSection[] = [];
  let current: { heading: string | null; anchor: string | null; lines: string[] } = {
    heading: null,
    anchor: null,
    lines: [],
  };
  let headingIndex = 0;
  let inCodeBlock = false;

  const flush = () => {
    const text = toSearchableText(current.lines.join('\n'));
    if (text.length > 0) {
      sections.push({ heading: current.heading, anchor: current.anchor, text });
    }
  };

  for (const line of lines) {
    // Track fences so a `## ` inside a code sample never starts a section.
    if (line.trim().startsWith('```')) inCodeBlock = !inCodeBlock;

    const match = inCodeBlock ? null : line.match(/^#{2,3}\s+(.+)$/);
    if (match) {
      flush();
      const heading = headings[headingIndex];
      headingIndex += 1;
      current = {
        heading: heading?.text ?? match[1].replace(/`/g, ''),
        anchor: heading?.id ?? null,
        lines: [],
      };
      continue;
    }
    current.lines.push(line);
  }
  flush();

  return sections;
}
