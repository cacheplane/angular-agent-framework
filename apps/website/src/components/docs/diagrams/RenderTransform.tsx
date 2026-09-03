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
 *
 * Tiled at the kit-standard 640 viewWidth (16px outer margins) against
 * measured glyph widths (JetBrains Mono / Inter, actual `getBBox()` reads —
 * not a character-count estimate) so every node keeps real slack between its
 * widest line and its right edge at this width, not just at the larger
 * marketing scale that stretches the SVG in CSS:
 *   node "type: 'Text'"        text 90.0  → w=113 (slack 7.0)
 *   node "@threadplane/render" text 142.5 → w=166 (slack 7.5)
 *   node "your components" /
 *     "your styles · your rules" text 112.8 → w=136 (slack 7.2)
 *   pill "UI spec"             text 42.0  → w=52  (pad 5.0/side)
 *   pill "bindings + events"   text 102.0 → w=112 (pad 5.0/side)
 * Inter-node gaps are a plain 5px segment, the pill, a 7px arrow-bearing
 * segment, and a 2px arrowhead stop-short — tight but exact, verified
 * against the live render rather than assumed.
 */
export function RenderTransform() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={96}
      scale="marketing"
      label="Generative UI transform: the agent emits a UI spec; @threadplane/render resolves it through your registry, state, and handlers into components you already own."
    >
      <DiagramNode
        x={16}
        y={16}
        w={113}
        h={64}
        eyebrow="On the wire"
        title="type: 'Text'"
        meta="props: { … }"
        metaStyle="mono"
        tone="dim"
      />
      <DiagramEdge d="M129 48 H134" slug={SLUG} />
      <DiagramPill cx={160} cy={48} w={52} label="UI spec" tone="neutral" />
      <DiagramEdge d="M186 48 H193" slug={SLUG} arrow />
      <DiagramNode
        x={195}
        y={16}
        w={166}
        h={64}
        eyebrow="Renderer"
        title="@threadplane/render"
        meta="registry · state · handlers"
      />
      <DiagramEdge d="M361 48 H366" slug={SLUG} />
      <DiagramPill cx={422} cy={48} w={112} label="bindings + events" tone="neutral" />
      <DiagramEdge d="M478 48 H485" slug={SLUG} arrow />
      <DiagramNode
        x={487}
        y={16}
        w={136}
        h={64}
        eyebrow="On screen"
        title="your components"
        titleStyle="sans"
        meta="your styles · your rules"
        tone="accent"
      />
    </DiagramFrame>
  );
}
