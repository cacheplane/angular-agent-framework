# chat

This library was generated with [Nx](https://nx.dev).

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
