# Chat Generative UI with @cacheplane/chat

<Summary>
Render dynamic UI components within chat messages using
ChatGenerativeUiComponent. The agent embeds JSON render specs
in responses that are rendered as live Angular components.
</Summary>

<Prompt>
Add generative UI to your chat interface using `ChatGenerativeUiComponent`
from `@cacheplane/chat` and `provideRender()` from `@cacheplane/render`.
Configure both providers to enable spec detection and rendering.
</Prompt>

<Steps>
<Step title="Configure the render provider">

Generative UI requires both `provideChat()` and `provideRender()`:

```typescript
import { provideRender } from '@cacheplane/render';
import { provideChat } from '@cacheplane/chat';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStreamResource({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
    provideRender({}),
  ],
};
```

</Step>
<Step title="Create a spec-emitting agent">

Configure the backend agent to include JSON render specs in its
responses using fenced code blocks with the `render-spec` tag.

</Step>
<Step title="Detect specs in messages">

ChatGenerativeUiComponent automatically scans messages for render
spec code blocks and extracts them for rendering.

</Step>
<Step title="Render with ChatGenerativeUiComponent">

Use the component in your template alongside ChatComponent:

```html
<chat [ref]="stream" />
<chat-generative-ui [ref]="stream" />
```

</Step>
<Step title="Customize the component registry">

Register custom Angular components to handle specific spec types:

```typescript
provideRender({
  registry: defineAngularRegistry({
    card: MyCardComponent,
    chart: MyChartComponent,
  }),
})
```

</Step>
</Steps>

<Tip>
Generative UI bridges the gap between conversational AI and rich
interactive interfaces — the agent can create forms, dashboards,
and visualizations on the fly.
</Tip>
