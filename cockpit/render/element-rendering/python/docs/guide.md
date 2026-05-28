# Element Rendering with @threadplane/render

<Summary>
Recursively render nested element trees using RenderElementComponent.
Each element resolves its type from the registry and supports visibility
conditions bound to a reactive state store.
</Summary>

<Prompt>
Add recursive element rendering to this Angular component using
`RenderElementComponent` from `@threadplane/render`. Define a nested element
spec, create a state store for visibility toggling, and render the tree.
</Prompt>

<Steps>
<Step title="Define a nested element spec">

Create a spec with nested children forming a recursive tree:

```typescript
const spec = {
  type: 'container',
  props: { class: 'space-y-2' },
  children: [
    { type: 'heading', props: { text: 'Parent Element' } },
    {
      type: 'container',
      props: { class: 'pl-4' },
      children: [
        { type: 'text', props: { content: 'Child element' } },
        { type: 'text', props: { content: 'Another child', visible: { bind: '/showDetail' } } },
      ],
    },
  ],
};
```

</Step>
<Step title="Create a state store for visibility">

Use `signalStateStore()` to manage visibility flags:

```typescript
import { signalStateStore } from '@threadplane/render';

const store = signalStateStore({ showDetail: true });
```

</Step>
<Step title="Render with RenderSpecComponent">

Pass the spec and store to the render component:

```html
<render-spec [spec]="spec" [store]="store" />
```

RenderElementComponent handles the recursive rendering internally,
walking each level of the tree.

</Step>
<Step title="Handle recursive children">

Each element in the tree is rendered by RenderElementComponent. Children
are resolved recursively, so deeply nested structures render correctly.
Visibility conditions at any level control the entire subtree below.

</Step>
<Step title="Connect to the backend">

Configure `provideAgent()` in your app config, then call `injectAgent()` to
receive element specs from the agent:

```typescript
// app.config.ts
import { provideAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: environment.langGraphApiUrl,
      assistantId: environment.streamingAssistantId,
    }),
  ],
};
```

```typescript
// app.component.ts
import { injectAgent } from '@threadplane/langgraph';

protected readonly stream = injectAgent();
```

</Step>
</Steps>

<Tip>
Use JSON Pointer paths like `/showDetail` to bind visibility conditions
to values in the state store.
</Tip>
