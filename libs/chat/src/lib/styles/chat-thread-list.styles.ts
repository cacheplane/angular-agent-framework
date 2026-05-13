// SPDX-License-Identifier: MIT
export const CHAT_THREAD_LIST_STYLES = `
  :host { display: block; padding: var(--ngaf-chat-space-2); }
  .chat-thread-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
  .chat-thread-list__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 36px;
    padding: 8px 12px;
    border-radius: var(--ngaf-chat-radius-button);
    cursor: pointer;
    color: var(--ngaf-chat-text);
    font-size: var(--ngaf-chat-font-size-sm);
    background: transparent;
    border: 0;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
    transition: background-color 150ms ease;
  }
  .chat-thread-list__item:hover { background: color-mix(in srgb, var(--ngaf-chat-text) 5%, transparent); }
  .chat-thread-list__item[data-active="true"] {
    background: var(--ngaf-chat-surface-alt);
    font-weight: 500;
    box-shadow: inset 2px 0 0 var(--a2ui-primary, var(--ngaf-chat-primary));
  }
  .chat-thread-list__item-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }
  .chat-thread-list__item-time {
    font-size: 11px;
    color: var(--ngaf-chat-text-muted);
    display: block;
  }
  .chat-thread-list__new {
    display: block;
    width: 100%;
    height: 36px;
    margin-bottom: var(--ngaf-chat-space-2);
    border: 1px dashed var(--ngaf-chat-separator);
    border-radius: var(--ngaf-chat-radius-button);
    background: transparent;
    color: var(--ngaf-chat-primary);
    cursor: pointer;
    font-size: var(--ngaf-chat-font-size-sm);
    box-sizing: border-box;
    transition: background 150ms ease;
  }
  .chat-thread-list__new:hover { background: var(--ngaf-chat-surface-alt); }
  .chat-thread-list__item-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chat-thread-list__item-wrap .chat-thread-list__item {
    flex: 1 1 auto;
    min-width: 0;
  }
  .chat-thread-list__kebab {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 100ms ease;
    padding: 0;
    line-height: 1;
    font-size: 18px;
  }
  .chat-thread-list__item-wrap:hover .chat-thread-list__kebab,
  .chat-thread-list__item-wrap:focus-within .chat-thread-list__kebab {
    opacity: 1;
  }
  .chat-thread-list__kebab:hover {
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
  }
  .chat-thread-list__kebab:focus-visible {
    opacity: 1;
    outline: 2px solid var(--ngaf-chat-primary);
    outline-offset: 2px;
  }
  .chat-thread-list__initial {
    display: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    background: var(--ngaf-chat-surface-alt);
    color: var(--ngaf-chat-text);
    font-weight: 500;
    font-size: 13px;
    flex-shrink: 0;
  }
  .chat-thread-list__item-pin {
    width: 11px;
    height: 11px;
    margin-right: 4px;
    color: var(--ngaf-chat-text-muted);
    vertical-align: -1px;
    display: inline-block;
  }
  .chat-thread-list__edit {
    flex: 1 1 auto;
    border: 1px solid var(--ngaf-chat-primary);
    border-radius: var(--ngaf-chat-radius-button);
    background: var(--ngaf-chat-bg);
    color: var(--ngaf-chat-text);
    font: inherit;
    font-size: var(--ngaf-chat-font-size-sm);
    padding: 6px 10px;
    min-height: 36px;
    outline: none;
    box-sizing: border-box;
  }
  .chat-thread-list__grip {
    flex-shrink: 0;
    width: 16px;
    height: 28px;
    margin-right: 2px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ngaf-chat-text-muted);
    cursor: grab;
    opacity: 0;
    transition: opacity 100ms ease;
    font-size: 11px;
    line-height: 1;
    letter-spacing: -1px;
    user-select: none;
  }
  .chat-thread-list__item-wrap:hover .chat-thread-list__grip,
  .chat-thread-list__item-wrap:focus-within .chat-thread-list__grip {
    opacity: 1;
  }
  .chat-thread-list__grip:active { cursor: grabbing; }

  .chat-thread-list__item-wrap[data-dragging="true"] {
    opacity: 0.4;
  }

  .chat-thread-list__item-wrap[data-drop-position="before"]::before,
  .chat-thread-list__item-wrap[data-drop-position="after"]::after {
    content: '';
    position: absolute;
    left: 4px;
    right: 4px;
    height: 2px;
    background: var(--ngaf-chat-primary);
    border-radius: 1px;
    pointer-events: none;
  }
  .chat-thread-list__item-wrap[data-drop-position="before"]::before { top: -1px; }
  .chat-thread-list__item-wrap[data-drop-position="after"]::after { bottom: -1px; }
`;
