import { Injectable, inject } from '@angular/core';
import {
  NGAF_TELEMETRY_CONFIG,
  type NgafTelemetryConfig,
  type NgafTelemetryEvent,
} from './tokens';

// Inlined from shared/events.ts: ng-packagr enforces rootDir at the entry-file
// level (src/browser/), so the browser entry cannot import from ../shared/.
// Keep this type in sync with shared/events.ts.
export type NgafBrowserEvent = NgafTelemetryEvent;

export interface NgafBrowserRuntimeTelemetry {
  transport: string;
  surface?: string;
  provider?: string;
  model?: string;
}

export interface NgafBrowserStreamTelemetry extends NgafBrowserRuntimeTelemetry {
  durationMs?: number;
}

export interface NgafBrowserStreamErrorTelemetry extends NgafBrowserStreamTelemetry {
  error?: unknown;
}

function normalizeSampleRate(sampleRate: number | undefined): number {
  if (sampleRate === undefined) return 1;
  if (!Number.isFinite(sampleRate)) return 1;
  if (sampleRate <= 0) return 0;
  if (sampleRate >= 1) return 1;
  return sampleRate;
}

function errorClass(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error && typeof error === 'object' && 'name' in error && typeof error.name === 'string') {
    return error.name;
  }
  return 'UnknownError';
}

@Injectable({ providedIn: 'root' })
export class NgafTelemetryService {
  private config: NgafTelemetryConfig | null = inject(NGAF_TELEMETRY_CONFIG, { optional: true });
  private postHogPromise: Promise<typeof import('posthog-js')['default'] | null> | null = null;
  private distinctId: string | null = null;

  async capture(event: NgafTelemetryEvent, properties?: Record<string, unknown>): Promise<void> {
    if (!this.config?.enabled) return;
    const sampleRate = normalizeSampleRate(this.config.sampleRate);
    if (sampleRate === 0) return;
    if (sampleRate < 1 && Math.random() >= sampleRate) return;

    const enrichedProperties = {
      ...(properties ?? {}),
      sample_weight: properties?.['sample_weight'] ?? 1 / sampleRate,
    };

    try {
      if (this.config.sink) {
        await this.config.sink({ event, properties: enrichedProperties });
        return;
      }
      if (this.config.endpoint) {
        await this.captureEndpoint(event, enrichedProperties);
        return;
      }
      if (!this.config.posthogKey) return;
      const ph = await this.loadPostHog();
      if (!ph) return;
      ph.capture(event, enrichedProperties);
    } catch {
      // silent fail
    }
  }

  captureRuntimeInstanceCreated(input: NgafBrowserRuntimeTelemetry): Promise<void> {
    return this.capture('ngaf:runtime_instance_created', { ...input });
  }

  captureStreamStarted(input: NgafBrowserStreamTelemetry): Promise<void> {
    return this.capture('ngaf:stream_started', { ...input });
  }

  captureStreamEnded(input: NgafBrowserStreamTelemetry): Promise<void> {
    return this.capture('ngaf:stream_ended', { ...input });
  }

  captureStreamErrored(input: NgafBrowserStreamErrorTelemetry): Promise<void> {
    const { error, ...rest } = input;
    return this.capture('ngaf:stream_errored', {
      ...rest,
      errorClass: errorClass(error),
    });
  }

  private async captureEndpoint(event: NgafTelemetryEvent, properties: Record<string, unknown>): Promise<void> {
    if (typeof fetch !== 'function' || !this.config?.endpoint) return;
    await fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event,
        distinctId: this.getDistinctId(),
        properties,
      }),
    });
  }

  private getDistinctId(): string {
    if (!this.distinctId) {
      const cryptoApi = globalThis.crypto as Crypto | undefined;
      const value = typeof cryptoApi?.randomUUID === 'function'
        ? cryptoApi.randomUUID()
        : Math.random().toString(36).slice(2, 12);
      this.distinctId = `browser:${value}`;
    }
    return this.distinctId;
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
