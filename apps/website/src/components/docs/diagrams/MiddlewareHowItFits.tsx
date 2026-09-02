// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'middleware-how-it-fits';

/**
 * The middleware intro's runtime flow, condensed to three stages: the
 * browser declares client tools through `@threadplane/chat`, the Python
 * `threadplane-middleware` package binds those tool stubs onto the model via
 * `bind_client_tools()` (verified against
 * `threadplane.middleware.langgraph.__init__`), and the bound model runs
 * inside your own LangGraph graph. The `client_tools` pill sits above the
 * first edge rather than on it — a horizontal edge with nothing else sharing
 * its line doesn't need the pill-break treatment vertical stacks do.
 */
export function MiddlewareHowItFits() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={136}
      label="How threadplane-middleware fits: the browser declares client tools through @threadplane/chat, threadplane-middleware binds them onto the model with bind_client_tools(), and the bound model runs inside your LangGraph graph."
    >
      <DiagramNode
        x={24}
        y={40}
        w={180}
        h={64}
        eyebrow="Frontend"
        title="@threadplane/chat"
        meta="<chat [clientTools]>"
        tone="neutral"
      />
      <DiagramPill cx={216} cy={48} w={90} label="client_tools" />
      <DiagramEdge d="M204 72 H224" slug={SLUG} arrow />
      <DiagramNode
        x={228}
        y={40}
        w={220}
        h={64}
        eyebrow="Python"
        title="threadplane-middleware"
        meta="bind_client_tools()"
        tone="accent"
      />
      <DiagramEdge d="M448 72 H468" slug={SLUG} arrow />
      <DiagramNode
        x={472}
        y={40}
        w={144}
        h={64}
        title="Your LangGraph graph"
        align="middle"
        titleStyle="sans"
        tone="dim"
      />
    </DiagramFrame>
  );
}
