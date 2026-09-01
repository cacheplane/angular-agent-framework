// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import type { ApplicationConfig, Type } from '@angular/core';
import { installRuntimeBridge } from '@threadplane/cockpit-runtime-bridge';
import { readCockpitConfigFromIframe } from './distinct-id';

/**
 * Entry helper for every Cockpit Angular example.
 *
 * When the cockpit harness URL params are present, telemetry is wired in.
 * When absent, bootstraps without telemetry — the provider and its posthog-js
 * dependency stay outside the loaded module graph.
 *
 * This helper owns the page's single Angular bootstrap. Call it once from the
 * entry point so the page installs exactly one runtime bridge listener.
 */
export async function bootstrapWithCockpitHarness(
  component: Type<unknown>,
  appConfig: ApplicationConfig,
): Promise<void> {
  const runtimeBridge = installRuntimeBridge();
  const harness = readCockpitConfigFromIframe();

  try {
    const providers = harness
      ? [
          ...(appConfig.providers ?? []),
          (await import('./provide-cockpit-telemetry')).provideCockpitTelemetry(harness),
        ]
      : (appConfig.providers ?? []);
    await bootstrapApplication(component, { ...appConfig, providers });
  } catch (error) {
    runtimeBridge.markError('bootstrap_failed');
    throw error;
  }

  runtimeBridge.markReady();
}
