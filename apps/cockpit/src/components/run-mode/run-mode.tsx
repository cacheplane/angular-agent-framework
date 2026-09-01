// SPDX-License-Identifier: MIT
'use client';

import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { ThemedFrame } from '@threadplane/ui-react';
import { getCockpitSessionId } from '../../lib/analytics/distinct-id';
import type { RuntimePhase } from '../../lib/runtime/runtime-state';

interface RunModeProps {
  entryTitle: string;
  runtimeUrl: string | null;
  capabilitySlug: string;
  frameRef?: RefObject<HTMLIFrameElement | null>;
  frameGeneration?: number;
  onFrameLoad?(): void;
  runtimePhase?: RuntimePhase;
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

interface IframeSource {
  identity: string;
  src: string;
}

export function RunMode({
  entryTitle,
  runtimeUrl,
  capabilitySlug,
  frameRef: externalFrameRef,
  frameGeneration = 0,
  onFrameLoad,
  runtimePhase = runtimeUrl ? 'connecting' : 'not_configured',
}: RunModeProps) {
  const fallbackFrameRef = useRef<HTMLIFrameElement>(null);
  const frameRef = externalFrameRef ?? fallbackFrameRef;
  const identity = runtimeUrl
    ? `${runtimeUrl}\u0000${capabilitySlug}`
    : null;
  const [iframeSource, setIframeSource] = useState<IframeSource | null>(null);

  useEffect(() => {
    if (runtimeUrl && runtimePhase !== 'invalid_configuration') {
      setIframeSource({
        identity: `${runtimeUrl}\u0000${capabilitySlug}`,
        src: buildIframeSrc(runtimeUrl, capabilitySlug),
      });
    } else {
      setIframeSource(null);
    }
  }, [runtimeUrl, capabilitySlug, runtimePhase]);

  if (runtimePhase === 'invalid_configuration') {
    return (
      <section aria-label="Run mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>Invalid runtime URL.</p>
      </section>
    );
  }

  if (!runtimeUrl) {
    return (
      <section aria-label="Run mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>No runtime available. Start the local dev server to preview.</p>
      </section>
    );
  }

  const src =
    identity !== null && iframeSource?.identity === identity
      ? iframeSource.src
      : null;

  if (!src) {
    return (
      <section aria-label="Run mode" className="grid place-items-center h-full">
        <div className="cockpit-runtime-loading" aria-label="Preparing runtime" />
      </section>
    );
  }

  return (
    <section aria-label="Run mode" className="h-full">
      <ThemedFrame
        key={frameGeneration}
        ref={frameRef}
        src={src}
        onLoad={onFrameLoad}
        referrerPolicy="origin"
        title={`${entryTitle} live example`}
        allow="clipboard-write"
        className="w-full h-full border-0 rounded"
      />
    </section>
  );
}
