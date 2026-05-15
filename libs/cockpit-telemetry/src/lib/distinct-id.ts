// SPDX-License-Identifier: MIT
import type { CockpitTelemetryConfig } from './tokens';

/**
 * Reads cockpit harness configuration from URL query parameters.
 *
 * The parent shell appends `cockpit_did`, `cockpit_phk`, `cockpit_cap`, and
 * optionally `cockpit_host` to the iframe `src`. Returns `null` when any of
 * the three required params are missing (no harness — example runs pristine).
 */
export function readCockpitConfigFromIframe(): CockpitTelemetryConfig | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const distinctId = params.get('cockpit_did');
  const posthogKey = params.get('cockpit_phk');
  const capabilitySlug = params.get('cockpit_cap');
  if (!distinctId || !posthogKey || !capabilitySlug) return null;
  return {
    posthogKey,
    posthogHost: params.get('cockpit_host') ?? 'https://us.i.posthog.com',
    distinctId,
    capabilitySlug,
  };
}
