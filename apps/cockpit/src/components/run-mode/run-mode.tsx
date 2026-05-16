// SPDX-License-Identifier: MIT
'use client';

import React, { useEffect, useState } from 'react';
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
  const ingestHost =
    process.env.NEXT_PUBLIC_COCKPIT_INGEST_HOST
      ?? (typeof window !== 'undefined' ? `${window.location.origin}/ingest` : undefined);
  if (ingestHost) url.searchParams.set('cockpit_host', ingestHost);
  return url.toString();
}

export function RunMode({ entryTitle, runtimeUrl, capabilitySlug }: RunModeProps) {
  // SSR-safe: render an empty iframe placeholder so HTML matches across server
  // and client, then fill the src in via effect once the session id is available.
  // `getCockpitSessionId()` returns a fresh UUID per process; on SSR that UUID
  // would differ from the one generated client-side, breaking hydration.
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (runtimeUrl) {
      setSrc(buildIframeSrc(runtimeUrl, capabilitySlug));
    } else {
      setSrc(null);
    }
  }, [runtimeUrl, capabilitySlug]);

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
        src={src ?? 'about:blank'}
        title={`${entryTitle} live example`}
        allow="clipboard-write"
        className="w-full h-full border-0 rounded"
      />
    </section>
  );
}
