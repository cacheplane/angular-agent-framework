// libs/chat/src/lib/styles/chat-markdown.styles.ts
// SPDX-License-Identifier: MIT
//
// Scoped to the `chat-streaming-md` element selector (not `:host`) because
// the component renders markdown via innerHTML and uses
// `ViewEncapsulation.None` — emulated encapsulation would skip these rules
// since innerHTML-injected nodes don't carry `_ngcontent-xxx` attributes.
// Keeping selectors prefixed with the element name preserves locality so
// these rules don't leak to other markup on the page.
//
// Covers the CommonMark + GFM surface: headings, paragraphs, links, lists
// (bullet/ordered/task), code (inline + fenced), blockquotes, horizontal
// rules, tables, images, bold (`strong`), italic (`em`), strikethrough
// (`del`/`s`).
export const CHAT_MARKDOWN_STYLES = `
  chat-streaming-md { display: block; color: var(--ngaf-chat-text); line-height: var(--ngaf-chat-line-height); }

  /* Headings */
  chat-streaming-md h1, chat-streaming-md h2, chat-streaming-md h3, chat-streaming-md h4, chat-streaming-md h5, chat-streaming-md h6 {
    font-weight: 600;
    line-height: 1.25;
    margin: 1.25rem 0 0.75rem;
  }
  chat-streaming-md h1:first-child, chat-streaming-md h2:first-child, chat-streaming-md h3:first-child,
  chat-streaming-md h4:first-child, chat-streaming-md h5:first-child, chat-streaming-md h6:first-child { margin-top: 0; }
  chat-streaming-md h1 { font-size: 1.5em; font-weight: 700; }
  chat-streaming-md h2 { font-size: 1.25em; }
  chat-streaming-md h3 { font-size: 1.1em; }
  chat-streaming-md h4 { font-size: 1em; }
  chat-streaming-md h5, chat-streaming-md h6 { font-size: 0.95em; color: var(--ngaf-chat-text-muted); }

  /* Paragraphs and inline emphasis */
  chat-streaming-md p { margin: 0 0 0.75rem; line-height: 1.6; font-size: var(--ngaf-chat-font-size); }
  chat-streaming-md p:last-child { margin-bottom: 0; }
  chat-streaming-md strong, chat-streaming-md b { font-weight: 700; }
  chat-streaming-md em, chat-streaming-md i { font-style: italic; }
  chat-streaming-md del, chat-streaming-md s { text-decoration: line-through; color: var(--ngaf-chat-text-muted); }
  chat-streaming-md mark { background: var(--ngaf-chat-surface-alt); padding: 0 2px; border-radius: 2px; }
  chat-streaming-md sub { font-size: 0.75em; vertical-align: sub; }
  chat-streaming-md sup { font-size: 0.75em; vertical-align: super; }

  /* Links */
  chat-streaming-md a { color: var(--ngaf-chat-primary); text-decoration: underline; text-underline-offset: 2px; }
  chat-streaming-md a:hover { text-decoration-thickness: 2px; }

  /* Lists (CommonMark + GFM task lists) */
  chat-streaming-md ul, chat-streaming-md ol { margin: 0 0 0.75rem; padding-left: 1.5rem; }
  chat-streaming-md ul { list-style: disc outside; }
  chat-streaming-md ol { list-style: decimal outside; }
  chat-streaming-md ul ul { list-style: circle outside; }
  chat-streaming-md ul ul ul { list-style: square outside; }
  chat-streaming-md li { margin: 0.2rem 0; }
  chat-streaming-md li::marker { color: var(--ngaf-chat-text-muted); }
  chat-streaming-md li > p { margin: 0 0 0.25rem; }
  chat-streaming-md li > ul, chat-streaming-md li > ol { margin: 0.25rem 0 0; }
  /* GFM task lists: marked emits <li><input type="checkbox" disabled> ... */
  chat-streaming-md li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.25rem; }
  chat-streaming-md li > input[type="checkbox"] { margin-right: 0.5rem; vertical-align: middle; }

  /* Code (inline + fenced) */
  chat-streaming-md code {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: var(--ngaf-chat-font-mono);
    font-size: 0.9em;
  }
  chat-streaming-md pre {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    padding: 12px 14px;
    border-radius: var(--ngaf-chat-radius-card);
    overflow-x: auto;
    font-family: var(--ngaf-chat-font-mono);
    font-size: var(--ngaf-chat-font-size-sm);
    line-height: 1.5;
    margin: 0 0 0.75rem;
  }
  chat-streaming-md pre code { background: transparent; padding: 0; border-radius: 0; font-size: inherit; }

  /* Blockquote */
  chat-streaming-md blockquote {
    border-left: 3px solid var(--ngaf-chat-separator);
    padding: 0.25rem 0 0.25rem 12px;
    margin: 0 0 0.75rem;
    color: var(--ngaf-chat-text-muted);
  }
  chat-streaming-md blockquote > :last-child { margin-bottom: 0; }

  /* Horizontal rule */
  chat-streaming-md hr {
    border: none;
    border-top: 1px solid var(--ngaf-chat-separator);
    margin: 1rem 0;
  }

  /* Tables (GFM) */
  chat-streaming-md table {
    border-collapse: collapse;
    margin: 0 0 0.75rem;
    width: 100%;
    font-size: 0.95em;
  }
  chat-streaming-md thead { background: var(--ngaf-chat-surface-alt); }
  chat-streaming-md th, chat-streaming-md td {
    border: 1px solid var(--ngaf-chat-separator);
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  chat-streaming-md th { font-weight: 600; }

  /* Media */
  chat-streaming-md img { max-width: 100%; height: auto; border-radius: 6px; }
`;
