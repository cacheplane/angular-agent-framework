// SPDX-License-Identifier: MIT
const CHAT_DEBUG_ROOT_STYLES = `
@layer ngaf-chat-debug {
  :root {
    --ngaf-chat-sidebar-claim-right: 0px;
    --ngaf-chat-debug-panel-size-h: 40vh;
    --ngaf-chat-debug-panel-size-w: 420px;
  }
  :root[data-ngaf-chat-debug="bottom"] {
    --ngaf-chat-debug-claim-bottom: var(--ngaf-chat-debug-panel-size-h, 40vh);
    --ngaf-chat-occupy-bottom: var(--ngaf-chat-debug-panel-size-h, 40vh);
  }
  :root[data-ngaf-chat-debug="right"] {
    --ngaf-chat-debug-claim-right: var(--ngaf-chat-debug-panel-size-w, 420px);
    --ngaf-chat-occupy-right: var(--ngaf-chat-debug-panel-size-w, 420px);
  }
  :root[data-ngaf-chat-debug="left"] {
    --ngaf-chat-debug-claim-left: var(--ngaf-chat-debug-panel-size-w, 420px);
    --ngaf-chat-occupy-left: var(--ngaf-chat-debug-panel-size-w, 420px);
  }
}
`;

const STYLE_ELEMENT_ID = 'ngaf-chat-debug-root-styles';

export function ensureChatDebugRootStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = CHAT_DEBUG_ROOT_STYLES;
  document.head.appendChild(style);
}
