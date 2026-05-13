import { cssVars, type Theme } from '@ngaf/design-tokens';

/**
 * Bootstraps an embedded example app's theme. Call once before the
 * framework (Angular, Vue, etc.) bootstraps.
 *
 * Behavior:
 *   1. Applies the default theme synchronously (sets `data-theme` and
 *      every `--ds-*` CSS variable on `document.documentElement`).
 *   2. Posts `{ type: 'ngaf:theme-request' }` to `window.parent` so the
 *      host (cockpit's `<ThemedFrame>`) replies with the current theme
 *      even if its broadcast ran before this iframe mounted.
 *   3. Listens for `ngaf:theme` messages and re-applies on receipt.
 *
 * Idempotent: subsequent identical messages are no-ops visually.
 */
export function installEmbeddedTheme(defaultTheme: Theme = 'dark'): void {
  const apply = (theme: Theme) => {
    document.documentElement.dataset.theme = theme;
    const vars = cssVars(theme) as Record<string, string>;
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value);
    }
  };

  apply(defaultTheme);

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data;
    if (
      data &&
      typeof data === 'object' &&
      data.type === 'ngaf:theme' &&
      (data.theme === 'light' || data.theme === 'dark')
    ) {
      apply(data.theme);
    }
  });

  window.parent?.postMessage({ type: 'ngaf:theme-request' }, '*');
}
