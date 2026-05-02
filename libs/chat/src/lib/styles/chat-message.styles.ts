// libs/chat/src/lib/styles/chat-message.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_MESSAGE_STYLES = `
  :host { display: block; }
  :host([data-role="user"]) {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }
  :host([data-role="user"][data-prev-role="assistant"]) { margin-top: 1.5rem; }
  :host([data-role="assistant"]) {
    display: block;
    position: relative;
    margin-top: 1.5rem;
    color: var(--ngaf-chat-text);
    line-height: 1.55;
    font-size: var(--ngaf-chat-font-size);
    max-width: 100%;
  }
  :host([data-role="assistant"]):first-child { margin-top: 0; }

  .chat-message__bubble {
    max-width: 80%;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-bubble);
    background: var(--ngaf-chat-primary);
    color: var(--ngaf-chat-on-primary);
    white-space: pre-wrap;
    line-height: var(--ngaf-chat-line-height-tight);
    font-size: var(--ngaf-chat-font-size);
    overflow-wrap: break-word;
  }

  .chat-message__assistant-body {
    padding: 0 12px 0 4px;
    overflow-wrap: break-word;
  }

  .chat-message__caret {
    display: none;
    margin-left: 2px;
    margin-top: 0.25rem;
    color: var(--ngaf-chat-text-muted);
    vertical-align: text-bottom;
  }
  :host([data-role="assistant"][data-current="true"][data-streaming="true"]) .chat-message__caret {
    display: inline-block;
    /* The caret is suppressed for the first 300ms of streaming so quick
       responses (one-or-two-token "hello"-style replies) never flash the
       cursor. Past 300ms the smooth pulse takes over (copilotkit-style)
       — easier on the eyes than a hard blink during long streams.
       Note: animations restart whenever the element is created/inserted,
       so this delay re-applies on every new streaming message. */
    opacity: 0;
    animation: ngaf-chat-caret-fade-in 200ms ease-out 300ms forwards,
               ngaf-chat-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 500ms infinite;
  }

  .chat-message__plain { /* system / tool fallback */ }

  .chat-message__controls {
    display: none;
    position: absolute;
    left: 0;
    bottom: -28px;
    gap: 1rem;
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }
  :host([data-role="assistant"]) .chat-message__controls {
    display: flex;
  }
  :host([data-role="assistant"]:hover) .chat-message__controls,
  :host([data-role="assistant"]:focus-within) .chat-message__controls,
  :host([data-current="true"]) .chat-message__controls {
    opacity: 1;
    pointer-events: auto;
  }
  @media (max-width: 768px) {
    :host([data-role="assistant"]) .chat-message__controls { opacity: 1; pointer-events: auto; }
  }
  .chat-message__control-btn {
    width: 20px;
    height: 20px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-primary);
    cursor: pointer;
    padding: 0;
    transition: transform 200ms ease;
  }
  .chat-message__control-btn:hover { transform: scale(1.05); }
  .chat-message__control-btn svg { width: 16px; height: 16px; pointer-events: none; }
`;
