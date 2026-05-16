// SPDX-License-Identifier: MIT
import { bootstrapApplication } from '@angular/platform-browser';
import type { ApplicationConfig, Type } from '@angular/core';
import { readCockpitConfigFromIframe } from './distinct-id';
import { provideCockpitTelemetry } from './provide-cockpit-telemetry';

/**
 * Entry helper for `main.cockpit.ts` of every example.
 *
 * When the cockpit harness URL params are present, telemetry is wired in.
 * When absent, bootstraps the app pristine — no telemetry providers, no
 * posthog-js import side effects beyond the static module graph (which never
 * pulls posthog-js because no consumer of {@link provideCockpitTelemetry}
 * is in the provider tree).
 */
export async function bootstrapWithCockpitHarness(
  component: Type<unknown>,
  appConfig: ApplicationConfig,
): Promise<void> {
  const harness = readCockpitConfigFromIframe();
  const providers = harness
    ? [...(appConfig.providers ?? []), provideCockpitTelemetry(harness)]
    : (appConfig.providers ?? []);
  await bootstrapApplication(component, { ...appConfig, providers });
}
