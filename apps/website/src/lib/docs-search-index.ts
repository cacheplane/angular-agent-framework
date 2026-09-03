import { stripFrontmatter } from './docs';
import { extractHeadings } from './extract-headings';
import type { DocSection } from './docs-search-types';

/**
 * Strip MDX component tags, keeping prose-bearing attributes and dropping the rest.
 *
 * `<StackDiagram caption="..." />` and `<Step title="Install the package">` (self-closing
 * or paired — a paired tag's own title carries real search content, e.g. a step name, that
 * would otherwise vanish since only its children survive) both have their `caption`/`title`
 * text kept; the markup itself is dropped. Closing tags are dropped outright.
 *
 * This is a hand-written scan, not a regex, on purpose: a regex whose attribute region is
 * `[^>]*` stops at the first `>`, even inside a quoted value, and leaks the tag's tail into
 * indexed text as raw markup for input like `title="a > b"`. The regex that instead matches
 * attributes as discrete `name` / `name="..."` units — `(?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|
 * [^\s>]+))?)*` — fixes that, but nests a `+`-quantified token inside a `*`-repeated group,
 * the textbook catastrophic-backtracking shape: an unterminated tag with many attributes
 * (verified with 5,000) hangs the process, since the engine tries every way to re-partition
 * the attribute run before giving up. A linear left-to-right scan that tracks quote state
 * has no such failure mode — worst case (many unterminated tags in a row) is polynomial, not
 * exponential, and real MDX never produces that shape anyway.
 */
function stripComponentTags(text: string): string {
  const isUpper = (ch: string | undefined) => ch !== undefined && /[A-Z]/.test(ch);
  let result = '';
  let i = 0;

  while (i < text.length) {
    const closing = text[i] === '<' && text[i + 1] === '/' && isUpper(text[i + 2]);
    const opening = text[i] === '<' && isUpper(text[i + 1]);

    if (closing || opening) {
      let j = i + (closing ? 2 : 1);
      while (j < text.length && /[\w.]/.test(text[j])) j += 1;

      let quote: string | null = null;
      let end = -1;
      for (let k = j; k < text.length; k += 1) {
        const ch = text[k];
        if (quote) {
          if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '>') {
          end = k;
          break;
        }
      }

      if (end !== -1) {
        if (closing) {
          result += ' ';
        } else {
          const tag = text.slice(i, end + 1);
          const prose = [...tag.matchAll(/\b(?:caption|title)="([^"]*)"/g)].map((m) => m[1]);
          result += ` ${prose.join(' ')} `;
        }
        i = end + 1;
        continue;
      }
      // No closing '>' found before the end of the string: not a real tag. Fall through
      // and copy the '<' literally rather than consuming the rest of the document.
    }

    result += text[i];
    i += 1;
  }

  return result;
}

/**
 * Fenced code is dropped deliberately: it is roughly half the corpus and
 * mostly noise for ranking. The cost is explicit — an error string that only
 * ever appears inside a code sample will not match. Inline code is kept,
 * because that is where API names appear in sentences.
 */
function toSearchableText(source: string): string {
  const withoutFencedCode = source.replace(/```[\s\S]*?```/g, ' ');
  // Un-fenced imports never occur in the corpus today (every import lives inside a
  // fenced block, already stripped above), but a doc that imports a component for
  // real JSX use would otherwise leak `import { Foo } from '...'` into a snippet.
  // Mirrors extractFirstParagraph's same stripping in docs.ts.
  const withoutImports = withoutFencedCode.replace(/^import\s.+$/gm, '');
  const withoutTags = stripComponentTags(withoutImports);

  return withoutTags
    // Markdown links and images: keep the text/alt, drop the target. The target is a
    // URL, not content — indexing it makes "github" or "docs" match nearly every page
    // that happens to link somewhere, and a raw `[text](url)` reads as broken in a
    // snippet. Non-greedy character classes (no nested `[`/`(`) keep this from running
    // away on a line with several links. Known limitation, not present in the corpus:
    // link text containing nested brackets (`[A [nested] B](url)`) will not match, and
    // the raw markdown including the URL survives instead of being stripped.
    .replace(/!?\[([^[\]]*)\]\([^()]*\)/g, '$1')
    // Emphasis: unwrap to inner text. Double markers first, so `**bold**` doesn't leave
    // stray single markers behind for the single-marker passes to trip over.
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/__([^_]+?)__/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    // Single-underscore emphasis only opens/closes at a word boundary, same as
    // CommonMark's intraword rule — so `_care_` unwraps but `TEXT_MESSAGE_CONTENT`,
    // whose underscores sit between word characters, is left untouched.
    .replace(/(?<!\w)_(?!_)([^_\n]+?)(?<!_)_(?!\w)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a doc body into one record per heading, plus one for the preamble.
 *
 * Headings and anchors come entirely from `extractHeadings` — there is no
 * second scan here for fences or `##`/`###` lines. `extractHeadings` reports
 * the source line each heading sits on, so this function only needs to slice
 * the line array between consecutive heading lines; it never has to decide
 * for itself what counts as a heading. That makes the two ways of reading a
 * doc's structure (TOC and search index) structurally the same scan, so they
 * cannot silently disagree about which body lines belong to which heading —
 * unlike re-implementing the fence/heading logic a second time and pairing
 * the two scans by position, which stays correct only as long as both scans
 * happen to be written identically.
 */
export function indexDocSections(source: string): DocSection[] {
  const body = stripFrontmatter(source);
  const headings = extractHeadings(body);
  const lines = body.split('\n');

  const sections: DocSection[] = [];
  const pushSection = (heading: string | null, anchor: string | null, start: number, end: number) => {
    const text = toSearchableText(lines.slice(start, end).join('\n'));
    if (text.length > 0) {
      sections.push({ heading, anchor, text });
    }
  };

  const firstHeadingLine = headings[0]?.line ?? lines.length;
  pushSection(null, null, 0, firstHeadingLine);

  headings.forEach((heading, index) => {
    const start = heading.line + 1;
    const end = headings[index + 1]?.line ?? lines.length;
    pushSection(heading.text, heading.id, start, end);
  });

  return sections;
}
