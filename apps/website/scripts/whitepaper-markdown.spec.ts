import { describe, it, expect } from 'vitest';
import { mdToHTML, escapeHtml } from './whitepaper-markdown';

/**
 * `mdToHTML` turns the model's markdown into the whitepaper body. It has
 * shipped three separate silent defects into published PDFs, each of which
 * DELETED text rather than merely misformatting it — so it is pinned here.
 *
 *  1. No inline-code rule, and no escaping: every `<chat-message-list>` in the
 *     prose was parsed as an unknown element and rendered as nothing, leaving
 *     an empty pair of backticks where a component name should be.
 *  2. Paragraphs were split AFTER fenced blocks were built, so a code sample
 *     containing a blank line was torn in half, its second half wrapped in a
 *     <p>, and its own markup left unescaped.
 *  3. The fix for (2) lifted fences out to a sentinel that the paragraph
 *     wrapper did not recognise, so the restored block landed inside a <p> —
 *     and `<p><pre>` is invalid, so the browser auto-closes the paragraph and
 *     leaves a stray `</p>`.
 *
 * Every case below is one of those. None of them is hypothetical.
 */
describe('mdToHTML', () => {
  it('escapes angle-bracketed names in inline code instead of eating them', () => {
    const out = mdToHTML('The `<chat-message-list>` component manages scroll.');
    expect(out).toContain('<code>&lt;chat-message-list&gt;</code>');
    // The literal name must not survive as parseable markup.
    expect(out).not.toMatch(/<chat-message-list>/);
    // Nor may the backticks reach the reader.
    expect(out).not.toContain('`');
  });

  it('keeps a fenced block whole when it contains a blank line', () => {
    const md = ['```ts', 'const a = 1;', '', 'const b = 2;', '```'].join('\n');
    const out = mdToHTML(md);
    expect((out.match(/<pre><code>/g) ?? []).length).toBe(1);
    expect(out).toMatch(/const a = 1;\n\nconst b = 2;/);
  });

  it('never nests a fenced block inside a paragraph', () => {
    const md = ['Intro.', '', '```ts', 'const a = 1;', '', 'const b = 2;', '```', '', 'Outro.'].join('\n');
    const out = mdToHTML(md);
    expect(out).not.toMatch(/<p>\s*<pre/);
    expect(out).not.toContain('</code></pre></p>');
  });

  it('escapes markup inside fenced blocks', () => {
    const md = ['```ts', 'template: `<chat [agent]="agent" />`', '```'].join('\n');
    const out = mdToHTML(md);
    // Quotes are deliberately not escaped: this is text content, not an
    // attribute value, so `"` needs no entity and escaping it would just make
    // the rendered code sample harder to read.
    expect(out).toContain('&lt;chat [agent]="agent" /&gt;');
  });

  it('leaks no sentinel into the output', () => {
    const md = ['a', '', '```ts', 'x', '```', '', 'b'].join('\n');
    const out = mdToHTML(md);
    expect(out).not.toContain(String.fromCharCode(0xe000));
    expect(out).not.toContain('FENCE');
  });
});

describe('escapeHtml', () => {
  it('escapes the characters that would otherwise be parsed as markup', () => {
    expect(escapeHtml('<a & b>')).toBe('&lt;a &amp; b&gt;');
  });

  it('escapes the ampersand first, so entities are not double-built', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});
