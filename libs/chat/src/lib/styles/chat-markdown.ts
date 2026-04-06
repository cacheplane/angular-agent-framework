// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { SecurityContext } from '@angular/core';
import type { DomSanitizer, SafeHtml } from '@angular/platform-browser';

let markedParse: ((src: string) => string) | null = null;
let markedLoaded = false;

function loadMarked(): void {
  if (markedLoaded) return;
  markedLoaded = true;
  try {
    // Dynamic require — marked is an optional peer dep
    const m = require('marked');
    markedParse = (src: string) => m.marked.parse(src, { async: false }) as string;
  } catch {
    markedParse = null;
  }
}

/**
 * Renders markdown content to sanitized HTML.
 * Falls back to plain text with newline->br conversion if `marked` is not installed.
 */
export function renderMarkdown(content: string, sanitizer: DomSanitizer): SafeHtml {
  loadMarked();
  if (markedParse) {
    const html = markedParse(content);
    return sanitizer.bypassSecurityTrustHtml(
      sanitizer.sanitize(SecurityContext.HTML, html) ?? ''
    );
  }
  // Fallback: escape HTML and convert newlines to <br>
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return sanitizer.bypassSecurityTrustHtml(escaped);
}

/**
 * CSS for styling rendered markdown HTML.
 * Uses .chat-md class prefix to avoid global conflicts.
 * Must be included in a component with ViewEncapsulation.None or via ::ng-deep.
 */
export const CHAT_MARKDOWN_STYLES = `
  .chat-md p { margin: 0 0 0.75em; }
  .chat-md p:last-child { margin-bottom: 0; }
  .chat-md code {
    background: var(--chat-bg-alt);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.875em;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  }
  .chat-md pre {
    background: var(--chat-bg-alt);
    padding: 12px 16px;
    border-radius: var(--chat-radius-card);
    overflow-x: auto;
    margin: 0.75em 0;
  }
  .chat-md pre code { background: none; padding: 0; }
  .chat-md ul, .chat-md ol { margin: 0.5em 0; padding-left: 1.5em; }
  .chat-md li { margin: 0.25em 0; }
  .chat-md a { color: var(--chat-text); text-decoration: underline; }
  .chat-md strong { font-weight: 600; }
  .chat-md blockquote {
    border-left: 3px solid var(--chat-border);
    padding-left: 12px;
    margin: 0.75em 0;
    color: var(--chat-text-muted);
  }
  .chat-md h1, .chat-md h2, .chat-md h3, .chat-md h4 { margin: 1em 0 0.5em; font-weight: 600; }
  .chat-md h1 { font-size: 1.25em; }
  .chat-md h2 { font-size: 1.125em; }
  .chat-md h3 { font-size: 1em; }
  .chat-md table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
  .chat-md th, .chat-md td { border: 1px solid var(--chat-border); padding: 6px 12px; text-align: left; }
  .chat-md th { background: var(--chat-bg-alt); font-weight: 600; font-size: 0.875em; }
`;
