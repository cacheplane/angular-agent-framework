// libs/chat/src/lib/styles/chat-markdown.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_MARKDOWN_STYLES = `
  :host { display: block; color: var(--ngaf-chat-text); line-height: var(--ngaf-chat-line-height); }
  :host h1, :host h2, :host h3, :host h4, :host h5, :host h6 { font-weight: bold; line-height: 1.2; margin: 0 0 1rem; }
  :host h1 { font-size: 1.5em; }
  :host h2 { font-size: 1.25em; font-weight: 600; }
  :host h3 { font-size: 1.1em; }
  :host h4 { font-size: 1em; }
  :host p { margin: 0 0 1rem; line-height: 1.75; font-size: var(--ngaf-chat-font-size); }
  :host p:last-child { margin-bottom: 0; }
  :host a { color: var(--ngaf-chat-primary); text-decoration: underline; }
  :host ul, :host ol { margin: 0 0 1rem; padding-left: 1.25rem; }
  :host code {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    padding: 1px 4px;
    border-radius: 4px;
    font-family: var(--ngaf-chat-font-mono);
    font-size: 0.9em;
  }
  :host pre {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    padding: 12px;
    border-radius: var(--ngaf-chat-radius-card);
    overflow-x: auto;
    font-family: var(--ngaf-chat-font-mono);
    font-size: var(--ngaf-chat-font-size-sm);
    margin: 0 0 1rem;
  }
  :host pre code { background: transparent; padding: 0; border-radius: 0; }
  :host blockquote {
    border-left: 3px solid var(--ngaf-chat-separator);
    padding-left: 12px;
    margin: 0 0 1rem;
    color: var(--ngaf-chat-text-muted);
  }
`;
