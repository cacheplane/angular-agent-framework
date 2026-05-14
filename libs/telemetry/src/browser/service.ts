import { Injectable, inject } from '@angular/core';
import { NGAF_TELEMETRY_CONFIG, type NgafTelemetryConfig } from './tokens';

// Inlined from shared/events.ts: ng-packagr enforces rootDir at the entry-file
// level (src/browser/), so the browser entry cannot import from ../shared/.
// Keep this type in sync with shared/events.ts.
export type NgafBrowserEvent =
  | 'ngaf:browser_provided'
  | 'ngaf:browser_chat_init';

@Injectable({ providedIn: 'root' })
export class NgafTelemetryService {
  private config: NgafTelemetryConfig | null = inject(NGAF_TELEMETRY_CONFIG, { optional: true });
  private postHogPromise: Promise<typeof import('posthog-js')['default'] | null> | null = null;

  async capture(event: NgafBrowserEvent, properties?: Record<string, unknown>): Promise<void> {
    if (!this.config?.enabled || !this.config.posthogKey) return;
    try {
      const ph = await this.loadPostHog();
      if (!ph) return;
      ph.capture(event, properties);
    } catch {
      // silent fail
    }
  }

  private loadPostHog(): Promise<typeof import('posthog-js')['default'] | null> {
    if (!this.postHogPromise) {
      this.postHogPromise = import('posthog-js').then((mod) => {
        if (!this.config?.posthogKey) return null;
        mod.default.init(this.config.posthogKey, {
          api_host: this.config.posthogHost ?? 'https://us.i.posthog.com',
        });
        return mod.default;
      }).catch(() => null);
    }
    return this.postHogPromise;
  }
}
