// libs/chat/src/lib/styles/chat-input.styles.ts
// SPDX-License-Identifier: MIT
export const CHAT_INPUT_STYLES = `
:host {
  display: block;
  width: 100%;
  padding: 0 var(--ngaf-chat-edge-pad);
  box-sizing: border-box;
}

.chat-input__container {
  width: 100%;
  max-width: var(--ngaf-chat-max-width);
  margin: 0 auto;
}

.chat-input__pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--ngaf-chat-surface);
  border: 1px solid var(--ngaf-chat-separator);
  border-radius: 9999px;
  padding: 8px 8px 8px 16px;
  min-height: 56px;
  box-sizing: border-box;
}

.chat-input__textarea {
  flex: 1 1 auto;
  border: 0;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--ngaf-chat-text);
  font: inherit;
  font-size: 1rem;
  line-height: 1.5;
  max-height: 1.5em;
  padding: 0;
  field-sizing: content;
  overflow-y: auto;
}
.chat-input__textarea::placeholder { color: var(--ngaf-chat-text-muted); }
.chat-input__textarea::-webkit-scrollbar { width: 4px; }
.chat-input__textarea::-webkit-scrollbar-thumb { background: var(--ngaf-chat-separator); border-radius: 4px; }

.chat-input__controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.chat-input__send,
.chat-input__send--stop {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 150ms ease, transform 150ms ease, background 150ms ease;
  padding: 0;
}
.chat-input__send {
  background: var(--ngaf-chat-text);
  color: var(--ngaf-chat-bg);
}
.chat-input__send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  background: var(--ngaf-chat-text-muted);
}
.chat-input__send:not(:disabled):hover { transform: scale(1.05); }
.chat-input__send svg { width: 16px; height: 16px; }

.chat-input__send--stop {
  background: var(--ngaf-chat-text-muted);
  color: var(--ngaf-chat-bg);
}
.chat-input__send--stop:hover { transform: scale(1.05); }
.chat-input__send--stop svg { width: 14px; height: 14px; }
`;
