// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'telemetry-how-it-fits';

/**
 * A diamond: the shared `@threadplane/telemetry` entry point (environment
 * and event helpers, verified against `libs/telemetry/package.json`
 * `exports["."]`) underpins both the browser and Node surfaces. Both
 * surfaces are genuine entry points a caller imports directly — the intro's
 * "Entry points" section lists all three import paths — and, when each is
 * enabled or explicitly invoked, both fan back in to the same ingest
 * endpoint (`DEFAULT_INGEST` in `libs/telemetry/src/node/client.ts`, and the
 * `endpoint`/`sink` delivery path documented for the browser surface). The
 * fan-in trunk breaks around its "sampled events" pill rather than drawing a
 * continuous line under it.
 */
export function TelemetryHowItFits() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={316}
      label="How @threadplane/telemetry fits: the shared package underpins both the browser and Node entry points, and both fan sampled events back in to the same ingest endpoint."
    >
      <DiagramNode
        x={210}
        y={16}
        w={220}
        h={64}
        eyebrow="Shared"
        title="@threadplane/telemetry"
        meta="environment + event helpers"
        tone="dim"
      />
      <DiagramEdge d="M320 80 V92" slug={SLUG} />
      <DiagramEdge d="M320 92 H175 V100" slug={SLUG} arrow />
      <DiagramEdge d="M320 92 H480 V100" slug={SLUG} arrow />
      <DiagramNode
        x={35}
        y={104}
        w={280}
        h={64}
        eyebrow="Entry"
        title="@threadplane/telemetry/browser"
        meta="provideThreadplaneTelemetry() · opt-in"
        tone="accent"
      />
      <DiagramNode
        x={355}
        y={104}
        w={250}
        h={64}
        eyebrow="Entry"
        title="@threadplane/telemetry/node"
        meta="captureEvent() · explicit calls only"
        tone="accent"
      />
      <DiagramEdge d="M175 168 V188 H320" slug={SLUG} />
      <DiagramEdge d="M480 168 V188 H320" slug={SLUG} />
      <DiagramEdge d="M320 188 V200" slug={SLUG} />
      <DiagramPill cx={320} cy={212} w={140} label="sampled events" />
      <DiagramEdge d="M320 224 V252" slug={SLUG} arrow />
      <DiagramNode
        x={170}
        y={256}
        w={300}
        h={44}
        title="https://threadplane.ai/api/ingest"
        align="middle"
        titleStyle="sans"
        tone="dim"
      />
    </DiagramFrame>
  );
}
