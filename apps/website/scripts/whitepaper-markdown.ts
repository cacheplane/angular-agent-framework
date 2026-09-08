/**
 * Markdown → HTML for the whitepaper body, kept apart from the generator.
 *
 * These are pure string functions, but they lived in `generate-whitepaper.ts`,
 * which imports puppeteer and the Anthropic SDK at module scope. That made
 * them effectively untestable — importing them dragged a browser-automation
 * library into a jsdom worker — which is how three separate text-DELETING
 * defects reached published PDFs without a single failing test. Splitting them
 * out is what lets `generate-whitepaper.spec.ts` exist at all.
 */
/**
 * Escape the characters that would otherwise be parsed as markup.
 *
 * Load-bearing for code spans: the prose is full of Angular element names like
 * `<chat-message-list>`. Unescaped, the browser parses those as unknown
 * elements — which render as NOTHING — so the shipped PDF read "` ` manages
 * scroll position" with the component name silently gone.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Marks a lifted-out fenced block. A Private Use Area character rather than
 * NUL: it cannot appear in prose, and unlike a control character it does not
 * trip `no-control-regex`.
 */
const FENCE_SENTINEL = '\uE000';

export function mdToHTML(md: string): string {
  // Fenced blocks are lifted out first so their contents are escaped exactly
  // once and never re-processed by the inline rules below. The sentinel is a
  // Private Use Area character rather than NUL: it cannot appear in prose, and
  // unlike a control character it does not trip `no-control-regex`.
  const fenced: string[] = [];
  const withoutFences = md.replace(
    /```[\w]*\n([\s\S]*?)```/g,
    (_match, code: string) => {
      fenced.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
      return `${FENCE_SENTINEL}FENCE${fenced.length - 1}${FENCE_SENTINEL}`;
    },
  );

  return withoutFences
    // Inline code. Without this the backticks survived verbatim into the PDF
    // and anything angle-bracketed inside them vanished.
    .replace(/`([^`\n]+)`/g, (_match, code: string) => `<code>${escapeHtml(code)}</code>`)
    // The model restates the chapter title as a top-level heading. The chapter
    // opener already renders that title, so an `<h1>` here would duplicate it —
    // and leaving `# ` unhandled leaked a literal hash into the body text.
    .replace(/^# .+$/gm, '')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^\n]+<\/li>\n?)+/g, match => `<ul>${match}</ul>`)
    .split('\n\n')
    .map(block => {
      // The fence sentinel must count as pre-formatted here. It does not start
      // with `<pre`, so without this the restored block lands inside a <p> —
      // and `<p><pre>` is invalid, so the browser auto-closes the paragraph and
      // leaves a stray `</p>`, which is the exact artifact this rewrite exists
      // to remove.
      if (
        block.startsWith(FENCE_SENTINEL) ||
        block.startsWith('<h') ||
        block.startsWith('<ul') ||
        block.startsWith('<pre')
      ) {
        return block;
      }
      const trimmed = block.trim();
      return trimmed ? `<p>${trimmed}</p>` : '';
    })
    .join('\n')
    .replace(/\uE000FENCE(\d+)\uE000/g, (_match, index: string) => fenced[Number(index)]);
}
