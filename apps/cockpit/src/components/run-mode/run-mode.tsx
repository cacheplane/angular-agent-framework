// SPDX-License-Identifier: MIT
import React from 'react';
import { ThemedFrame } from '@ngaf/ui-react';
import { getCockpitSessionId } from '../../lib/analytics/distinct-id';

interface RunModeProps {
  entryTitle: string;
  runtimeUrl: string | null;
  capabilitySlug: string;
}

function buildIframeSrc(runtimeUrl: string, capabilitySlug: string): string {
  const url = new URL(runtimeUrl);
  url.searchParams.set('cockpit_did', getCockpitSessionId());
  url.searchParams.set('cockpit_cap', capabilitySlug);
  const phk = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN;
  if (phk) url.searchParams.set('cockpit_phk', phk);
  const host = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_HOST;
  if (host) url.searchParams.set('cockpit_host', host);
  return url.toString();
}

export function RunMode({ entryTitle, runtimeUrl, capabilitySlug }: RunModeProps) {
  if (!runtimeUrl) {
    return (
      <section aria-label="Run mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>No runtime available. Start the local dev server to preview.</p>
      </section>
    );
  }

  return (
    <section aria-label="Run mode" className="h-full">
      <ThemedFrame
        src={buildIframeSrc(runtimeUrl, capabilitySlug)}
        title={`${entryTitle} live example`}
        allow="clipboard-write"
        className="w-full h-full border-0 rounded"
      />
    </section>
  );
}
