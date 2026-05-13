// libs/chat/src/lib/styles/chat-sidenav.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_SIDENAV_STYLES = `
  /*
   * In expanded / collapsed modes the sidenav is "always visible" beside the
   * main content — the consumer reserves space with padding-left on the
   * layout container. The host must be position: fixed so it doesn't
   * participate in document flow; otherwise its display: block stretches
   * to the parent's full width and pushes siblings below the viewport.
   */
  :host {
    display: block;
    height: 100%;
  }
  :host([data-mode="expanded"]),
  :host([data-mode="collapsed"]) {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
  }
  :host([data-mode="expanded"]) {
    width: var(--ngaf-chat-sidenav-width-expanded);
  }
  :host([data-mode="collapsed"]) {
    width: var(--ngaf-chat-sidenav-width-collapsed);
  }
  :host([data-mode="expanded"]) .chat-sidenav {
    width: 100%;
  }
  :host([data-mode="collapsed"]) .chat-sidenav {
    width: 100%;
  }
  :host([data-mode="drawer"]) {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--ngaf-chat-sidenav-width-drawer);
    z-index: 1001;
  }
  .chat-sidenav {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--ngaf-chat-bg);
    border-right: 1px solid var(--ngaf-chat-separator);
    box-sizing: border-box;
    overflow: hidden;
  }
  .chat-sidenav__scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 1000;
    border: 0;
    padding: 0;
    cursor: pointer;
  }
  :host([data-mode="drawer"]) .chat-sidenav {
    width: 100%;
    height: 100%;
    transition: transform 200ms ease;
    transform: translateX(-100%);
  }
  :host([data-mode="drawer"][data-open="true"]) .chat-sidenav {
    transform: translateX(0);
  }
  .chat-sidenav__header {
    flex-shrink: 0;
    padding: var(--ngaf-chat-space-3);
    border-bottom: 1px solid var(--ngaf-chat-separator);
  }
  .chat-sidenav__topbar {
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: var(--ngaf-chat-space-2) var(--ngaf-chat-space-3);
    border-bottom: 1px solid var(--ngaf-chat-separator);
  }
  :host([data-mode="collapsed"]) .chat-sidenav__topbar {
    justify-content: center;
    padding: var(--ngaf-chat-space-2);
  }
  .chat-sidenav__topbar .chat-sidenav__action {
    width: 36px;
    height: 36px;
    padding: 0;
    justify-content: center;
    flex: 0 0 auto;
  }
  .chat-sidenav__topbar .chat-sidenav__action-label {
    display: none;
  }
  .chat-sidenav__actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--ngaf-chat-space-3);
  }
  :host([data-mode="collapsed"]) .chat-sidenav__actions {
    align-items: center;
    padding: var(--ngaf-chat-space-2);
  }
  .chat-sidenav__action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text);
    border-radius: 8px;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .chat-sidenav__action:hover { background: var(--ngaf-chat-surface-alt); }
  .chat-sidenav__action:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__action {
    width: 36px;
    height: 36px;
    padding: 0;
    justify-content: center;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__action-label {
    display: none;
  }
  .chat-sidenav__action-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .chat-sidenav__primary,
  .chat-sidenav__sections {
    flex-shrink: 0;
  }
  .chat-sidenav__threads {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
  .chat-sidenav__threads-heading {
    padding: 8px 12px 4px;
    font-size: var(--ngaf-chat-font-size-xs);
    color: var(--ngaf-chat-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  :host([data-mode="collapsed"]) .chat-sidenav__threads-heading {
    display: none;
  }
  .chat-sidenav__account {
    flex-shrink: 0;
    border-top: 1px solid var(--ngaf-chat-separator);
    padding: var(--ngaf-chat-space-3);
  }
  :host([data-mode="collapsed"]) .chat-sidenav__account {
    padding: var(--ngaf-chat-space-2);
  }
  .chat-sidenav__archived { flex-shrink: 0; }
  .chat-sidenav__archived-heading {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px 4px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
    cursor: pointer;
  }
  .chat-sidenav__archived-heading:hover { color: var(--ngaf-chat-text); }
  .chat-sidenav__archived-heading:focus-visible {
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  .chat-sidenav__archived-chevron {
    width: 12px;
    height: 12px;
    transition: transform 150ms ease;
    flex-shrink: 0;
  }
  .chat-sidenav__archived[data-open="true"] .chat-sidenav__archived-chevron {
    transform: rotate(90deg);
  }
  .chat-sidenav__archived-empty {
    padding: 8px 12px;
    color: var(--ngaf-chat-text-muted);
    font-size: var(--ngaf-chat-font-size-sm);
  }
  :host([data-mode="collapsed"]) .chat-sidenav__archived { display: none; }
  .chat-sidenav__projects { flex-shrink: 0; }
  :host([data-mode="collapsed"]) .chat-sidenav__projects { display: none; }
`;
