import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const themeCss = readFileSync(
  resolve(__dirname, '../theme.css'),
  'utf8',
);

describe('example-layouts theme chat token bridge', () => {
  it('maps public chat surface and text tokens to design tokens', () => {
    expect(themeCss).toContain('--tplane-chat-bg: var(--ds-canvas);');
    expect(themeCss).toContain('--tplane-chat-surface: var(--ds-surface);');
    expect(themeCss).toContain('--tplane-chat-surface-alt: var(--ds-surface-tinted);');
    expect(themeCss).toContain('--tplane-chat-text: var(--ds-text-primary);');
    expect(themeCss).toContain('--tplane-chat-text-muted: var(--ds-text-muted);');
    expect(themeCss).toContain('--tplane-chat-separator: var(--ds-border);');
  });

  it('defines the chat public control surface used by cockpit examples', () => {
    for (const token of [
      '--tplane-chat-input-bg',
      '--tplane-chat-muted',
      '--tplane-chat-primary',
      '--tplane-chat-accent',
      '--tplane-chat-on-primary',
      '--tplane-chat-font-family',
      '--tplane-chat-font-mono',
      '--tplane-chat-font-size',
      '--tplane-chat-font-size-sm',
      '--tplane-chat-font-size-xs',
      '--tplane-chat-line-height',
      '--tplane-chat-line-height-tight',
      '--tplane-chat-radius-card',
      '--tplane-chat-radius-button',
      '--tplane-chat-radius-bubble',
      '--tplane-chat-radius-input',
      '--tplane-chat-radius-launcher',
      '--tplane-chat-shadow-sm',
      '--tplane-chat-shadow-md',
      '--tplane-chat-shadow-lg',
      '--tplane-chat-success',
      '--tplane-chat-warning-bg',
      '--tplane-chat-warning-text',
      '--tplane-chat-error-bg',
      '--tplane-chat-error-border',
      '--tplane-chat-error-text',
      '--tplane-chat-destructive',
    ]) {
      expect(themeCss).toContain(`${token}:`);
    }
  });
});
