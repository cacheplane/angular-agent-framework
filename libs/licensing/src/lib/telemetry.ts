// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

export interface TelemetryEvent {
  package: string;
  version: string;
  licenseId?: string;
}

export interface TelemetryClient {
  send(event: TelemetryEvent): Promise<void>;
}

export interface CreateTelemetryClientOptions {
  endpoint: string;
  /** Injected for testability. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Injected for testability. Defaults to `crypto.randomUUID()`. */
  generateInstanceId?: () => string;
}

function isOptedOut(): boolean {
  // Access `process` via globalThis so this module bundles cleanly for
  // browser/Angular targets where `process` is not a declared global.
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
    CACHEPLANE_TELEMETRY?: unknown;
  };
  const envFlag = g.process?.env?.['CACHEPLANE_TELEMETRY'];
  if (envFlag === '0' || envFlag === 'false') return true;
  const override = g.CACHEPLANE_TELEMETRY;
  if (override === false || override === 0 || override === '0') return true;
  return false;
}

function defaultInstanceId(): string {
  // `crypto.randomUUID` is available in Node 19+, modern browsers,
  // and all edge runtimes we target.
  return crypto.randomUUID();
}

export function createTelemetryClient(
  options: CreateTelemetryClientOptions,
): TelemetryClient {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const makeId = options.generateInstanceId ?? defaultInstanceId;
  const anonInstanceId = makeId();

  return {
    async send(event: TelemetryEvent): Promise<void> {
      if (isOptedOut()) return;
      if (!fetchImpl) return;

      const body = JSON.stringify({
        package: event.package,
        version: event.version,
        license_id: event.licenseId,
        anon_instance_id: anonInstanceId,
        ts: Math.floor(Date.now() / 1000),
      });

      try {
        await fetchImpl(options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          // `keepalive` helps in browser unload paths; harmless elsewhere.
          keepalive: true,
        });
      } catch {
        // Never block the host app on telemetry failure.
      }
    },
  };
}
