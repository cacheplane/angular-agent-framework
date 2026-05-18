// SPDX-License-Identifier: MIT

/**
 * Component-scoped CSS variables for the chat-debug devtools chrome.
 *
 * Imported into every chat-debug component / primitive's `styles` array
 * so the defaults are set on each `:host` element. Hosts override by
 * setting any token on `chat-debug` or any ancestor.
 *
 * Independent from `--ngaf-chat-*` (the chat library's theme tokens).
 * Devtools chrome stays dark regardless of host theme by default —
 * matches Chrome DevTools / React DevTools / Redux DevTools convention.
 *
 * Palette anchor: shadcn zinc-900 + accent blue.
 */
export const CHAT_DEBUG_TOKENS = `
  :host {
    --ngaf-chat-debug-bg: #18181b;
    --ngaf-chat-debug-bg-deep: #09090b;
    --ngaf-chat-debug-surface: #1f1f23;
    --ngaf-chat-debug-border: #27272a;
    --ngaf-chat-debug-border-strong: #3f3f46;
    --ngaf-chat-debug-text: #fafafa;
    --ngaf-chat-debug-text-muted: #a1a1aa;
    --ngaf-chat-debug-text-subtle: #71717a;
    --ngaf-chat-debug-accent: #4f8df5;
    --ngaf-chat-debug-success: #4ade80;
    --ngaf-chat-debug-shadow-panel: 0 8px 32px rgba(0, 0, 0, 0.5);
    --ngaf-chat-debug-shadow-pill: 0 6px 18px rgba(0, 0, 0, 0.4);
    --ngaf-chat-debug-radius-panel: 12px;
    --ngaf-chat-debug-radius-input: 8px;
    --ngaf-chat-debug-radius-pill: 999px;
    --ngaf-chat-debug-font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --ngaf-chat-debug-font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-family: var(--ngaf-chat-debug-font-sans);
    color: var(--ngaf-chat-debug-text);

    /*
     * Cascade shim: rewire the chat library's color tokens to debug
     * equivalents so embedded components that consume \`--ngaf-chat-*\`
     * (debug-checkpoint-card, debug-state-diff, debug-state-inspector,
     * any host-projected slot content) pick up the dark devtools surface
     * without each one needing its own re-skin. Geometry / font tokens
     * are left alone — they're neutral.
     */
    --ngaf-chat-bg: var(--ngaf-chat-debug-bg);
    --ngaf-chat-text: var(--ngaf-chat-debug-text);
    --ngaf-chat-text-muted: var(--ngaf-chat-debug-text-muted);
    --ngaf-chat-separator: var(--ngaf-chat-debug-border);
    --ngaf-chat-surface-alt: var(--ngaf-chat-debug-bg-deep);
    --ngaf-chat-font-size-xs: 12px;
    --ngaf-chat-font-mono: var(--ngaf-chat-debug-font-mono);
    --ngaf-chat-radius-card: 8px;
    --ngaf-chat-success: var(--ngaf-chat-debug-success);
    --ngaf-chat-error-bg: color-mix(in srgb, #ef4444 18%, transparent);
    --ngaf-chat-error-text: #fca5a5;
    --ngaf-chat-warning-bg: color-mix(in srgb, #f59e0b 18%, transparent);
    --ngaf-chat-warning-text: #fcd34d;
  }
`;
