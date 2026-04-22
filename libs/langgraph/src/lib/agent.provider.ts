// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { InjectionToken, Provider } from '@angular/core';
import {
  runLicenseCheck,
  LICENSE_PUBLIC_KEY,
  inferNoncommercial,
} from '@cacheplane/licensing';
import { AgentTransport } from './agent.types';

const PACKAGE_NAME = '@cacheplane/langgraph';
// Wired up by the release pipeline — imported lazily to avoid a hard build-time
// dependency on package.json.
declare const __CACHEPLANE_AGENT_VERSION__: string | undefined;
const PACKAGE_VERSION =
  typeof __CACHEPLANE_AGENT_VERSION__ !== 'undefined'
    ? __CACHEPLANE_AGENT_VERSION__
    : '0.0.0-dev';
const TELEMETRY_ENDPOINT =
  'https://telemetry.cacheplane.dev/v1/ping';

/**
 * Global configuration for agent instances.
 * Properties set here serve as defaults that can be overridden per-call.
 */
export interface AgentConfig {
  /** Base URL of the LangGraph Platform API (e.g., `'http://localhost:2024'`). */
  apiUrl?:    string;
  /** Custom transport implementation. Defaults to {@link FetchStreamTransport}. */
  transport?: AgentTransport;
  /** Signed license token from cacheplane.dev. Optional; omitted in dev. */
  license?: string;
  /**
   * @internal
   * Test-only env hint override. Not part of the stable API.
   */
  __licenseEnvHint?: { isNoncommercial: boolean };
  /**
   * @internal
   * Test-only public-key override. Defaults to the compile-time embedded
   * `LICENSE_PUBLIC_KEY`. Not part of the stable API.
   */
  __licensePublicKey?: Uint8Array;
}

export const AGENT_CONFIG = new InjectionToken<AgentConfig>('AGENT_CONFIG');

/**
 * Angular provider factory that registers global defaults for all
 * agent instances in the application.
 */
export function provideAgent(config: AgentConfig): Provider {
  // Fire-and-forget license check. Never blocks DI resolution.
  void runLicenseCheck({
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    token: config.license,
    publicKey: config.__licensePublicKey ?? LICENSE_PUBLIC_KEY,
    telemetryEndpoint: TELEMETRY_ENDPOINT,
    isNoncommercial:
      config.__licenseEnvHint?.isNoncommercial ?? inferNoncommercial(),
  });

  return { provide: AGENT_CONFIG, useValue: config };
}
