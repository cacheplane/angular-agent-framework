// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'render-transform';

/**
 * /render marketing graphic: a horizontal transform story. A UI spec —
 * abbreviated from the `@threadplane/render` intro's own example
 * (`type: 'Text'`, `props: { label: { $state: '/message' } }`) — resolves
 * through `@threadplane/render`'s registry/state/handlers into components
 * you already own. The right-hand node carries the payoff accent; the
 * renderer and both pills stay neutral so the accent reads as a single beat.
 */
export function RenderTransform() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={760}
      viewHeight={96}
      scale="marketing"
      label="Generative UI transform: the agent emits a UI spec; @threadplane/render resolves it through your registry, state, and handlers into components you already own."
    >
      <DiagramNode
        x={16}
        y={16}
        w={134}
        h={64}
        eyebrow="On the wire"
        title="type: 'Text'"
        meta="props: { … }"
        metaStyle="mono"
        tone="dim"
      />
      <DiagramEdge d="M150 48 H160" slug={SLUG} />
      <DiagramPill cx={199} cy={48} w={78} label="UI spec" tone="neutral" />
      <DiagramEdge d="M238 48 H248" slug={SLUG} arrow />
      <DiagramNode
        x={252}
        y={16}
        w={196}
        h={64}
        eyebrow="Renderer"
        title="@threadplane/render"
        meta="registry · state · handlers"
      />
      <DiagramEdge d="M448 48 H458" slug={SLUG} />
      <DiagramPill cx={528} cy={48} w={140} label="bindings + events" tone="neutral" />
      <DiagramEdge d="M598 48 H608" slug={SLUG} arrow />
      <DiagramNode
        x={612}
        y={16}
        w={128}
        h={64}
        eyebrow="On screen"
        title="your components"
        titleStyle="sans"
        meta="no new framework"
        tone="accent"
      />
    </DiagramFrame>
  );
}
