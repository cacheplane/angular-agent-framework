# Element Rendering with @cacheplane/render

<Summary>
Recursively render nested element trees using RenderElementComponent.
Each element resolves its type from the registry and supports visibility
conditions bound to a reactive state store.
</Summary>

<Prompt>
Add recursive element rendering to this Angular component using
`RenderElementComponent` from `@cacheplane/render`. Define a nested element
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
import { signalStateStore } from '@cacheplane/render';

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

Use `agent()` to receive element specs from the agent:

```typescript
protected readonly stream = agent({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
});
```

</Step>
</Steps>

<Tip>
Use JSON Pointer paths like `/showDetail` to bind visibility conditions
to values in the state store.
</Tip>
