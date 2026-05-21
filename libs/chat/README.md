# @ngaf/chat

Drop-in agent chat UI for Angular 20+. Headless primitives that read from a runtime-neutral `Agent` contract, plus opinionated compositions (`<chat>`, `<chat-debug>`, GenUI surfaces) you can ship in days.

Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework).

`@ngaf/chat` is source-available and free for noncommercial use under the PolyForm Noncommercial License 1.0.0. Commercial production use requires a Threadplane commercial license.

This package is not licensed as OSI open source because commercial use requires a license. Threadplane uses a source-available model for `@ngaf/chat` while keeping protocol and ecosystem packages permissively licensed where appropriate.

## Commercial use

Building a commercial product, SaaS application, internal business tool, agency deliverable, or paid client project with `@ngaf/chat` requires a commercial license.

Free under PolyForm Noncommercial:

- Personal, hobby, student, academic, nonprofit, public-demo use
- Open-source applications released under an OSI-approved license
- Evaluation and prototyping (commercial evaluation is free for 30 days)

See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use, [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md) for the commercial license summary, and the [Threadplane pricing page](https://threadplane.ai/pricing) for plans.

## Runtime adapters

Chat primitives consume a runtime-neutral `Agent` contract. Two adapters ship today:

- **`@ngaf/langgraph`** — for LangGraph / LangGraph Platform backends.
- **`@ngaf/ag-ui`** — for any AG-UI-compatible backend (LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime).

Custom backends can implement `Agent` directly with no library dependency.

See the capability matrix in the docs site for which primitives require which runtime capabilities.

## Citations

Chat messages can include citations to sources. The `Citation` interface provides structured metadata for each source:

```ts
interface Citation {
  id: string;          // Unique identifier for the citation
  index?: number;      // Display index (1-based) for inline markers
  title?: string;      // Source title
  url?: string;        // Source URL
  snippet?: string;    // Quoted excerpt
  extra?: unknown;     // Custom fields per adapter
}
```

### Message citations

Adapters populate `Message.citations?: Citation[]` from their respective backends. Messages are rendered with the `<chat-citations [message]="message" />` primitive, which displays a collapsible sources panel under assistant messages.

### Rendering sources

Use the `<chat-citations>` component to render a sources panel. Customize the card layout with the optional `chatCitationCard` ng-template:

```html
<chat [agent]="agent" />
<!-- or explicit: -->
<chat-citations [message]="message">
  <ng-template chatCitationCard let-citation>
    <div class="custom-card">
      <a [href]="citation.url">{{ citation.title }}</a>
      <p class="text-sm text-gray-600">{{ citation.snippet }}</p>
    </div>
  </ng-template>
</chat-citations>
```

### Inline markers

Markdown rendering registers `chat-md-citation-reference` in the markdown view registry. Citation indices are rendered as superscript markers inline with the message text. The markers link to the corresponding citation in the sources panel.

### Adapter integration

Each runtime adapter extracts citations into the `Message.citations` array:

- **LangGraph** — reads from `message.additional_kwargs.citations` (preferred) or `message.additional_kwargs.sources` (fallback)
- **AG-UI** — reads from STATE_DELTA at JSON Pointer `/citations/{messageId}`

The `CitationsResolverService` is provided to query citations in message-first or markdown-fallback order.

## A2UI surface theming

`<a2ui-surface>` declares ~50 internal `--a2ui-*` tokens at `:host` with dark-theme defaults (spacing, typography, shape radius, focus ring, motion, elevation, color). Catalog components consume them via `var(--a2ui-*)`. Override at `:root` to retheme.

### Agent-driven theming (v1 wire format)

Agents control exactly two knobs per the canonical A2UI v1-compatible spec, set via `beginRendering.styles`:

- `font` — primary font family
- `primaryColor` — hex `#RRGGBB`

Both flow through to the rendered surface as inline styles on `<a2ui-surface>` (highest specificity), overriding any consumer `:root` defaults for the lifetime of that surface.

### Built-in theme presets

Four CSS files ship in the package, each declaring `:root` overrides for the relevant tokens:

```css
/* In your global stylesheet */
@import '@ngaf/chat/themes/default-dark.css';     /* lib defaults, explicit */
@import '@ngaf/chat/themes/default-light.css';    /* neutral light, blue accent */
@import '@ngaf/chat/themes/material-dark.css';    /* Material Design 3 dark */
@import '@ngaf/chat/themes/material-light.css';   /* Material Design 3 light */
```

Material presets map [Material Design 3 color tokens](https://m3.material.io/styles/color/the-color-system/tokens) to the `--a2ui-*` vocabulary — no `@angular/material` runtime dep, just CSS custom-property declarations.

### Custom themes

Override any subset of the ~50 tokens at `:root`:

```css
:root {
  --a2ui-primary: #FF6B35;        /* brand orange */
  --a2ui-shape-medium: 4px;       /* sharper corners */
  --a2ui-spacing-3: 16px;         /* roomier layouts */
}
```

The token surface:
- **Color** — `--a2ui-primary`, `--a2ui-on-primary`, `--a2ui-secondary`, `--a2ui-surface`, `--a2ui-on-surface`, `--a2ui-surface-variant`, `--a2ui-on-surface-variant`, `--a2ui-outline`, `--a2ui-outline-variant`, `--a2ui-error`, `--a2ui-on-error`, `--a2ui-scrim`
- **Spacing** — `--a2ui-spacing-1` (4px) through `--a2ui-spacing-7` (40px)
- **Typography** — `--a2ui-typography-{h1..h5,body,caption,label}-{size,weight,line-height}`
- **Shape** — `--a2ui-shape-{extra-small,small,medium,large,extra-large}`
- **Focus ring** — `--a2ui-focus-ring-color`, `--a2ui-focus-ring-width`
- **Motion** — `--a2ui-motion-duration-{short,medium,long}`, `--a2ui-motion-easing-{standard,emphasized}`
- **Elevation** — `--a2ui-elevation-{0,1,2,3,4,5}` (box-shadow tokens)
