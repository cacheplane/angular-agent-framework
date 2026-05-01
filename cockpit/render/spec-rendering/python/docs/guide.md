# Spec Rendering with @ngaf/render

<Summary>
Render Angular components from JSON specifications using RenderSpecComponent.
The component recursively resolves element types from a registry and renders
them with reactive prop bindings.
</Summary>

<Prompt>
Add JSON-driven UI rendering to this Angular component using `RenderSpecComponent`
from `@ngaf/render`. Define a registry with `defineAngularRegistry()`, create
a state store with `signalStateStore()`, and pass a JSON spec to the template.
</Prompt>

<Steps>
<Step title="Configure the render provider">

Set up `provideRender()` in your app config with a component registry:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRender } from '@ngaf/render';
import { defineAngularRegistry } from '@ngaf/render';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRender({
      registry: defineAngularRegistry({}),
    }),
  ],
};
```

</Step>
<Step title="Define a JSON render spec">

Create a spec object describing your UI layout. Each element has a `type` that
maps to a registered Angular component:

```typescript
const spec = {
  type: 'container',
  props: { class: 'p-4 space-y-2' },
  children: [
    { type: 'heading', props: { text: 'Hello from a JSON spec' } },
    { type: 'text', props: { content: 'Rendered by RenderSpecComponent' } },
  ],
};
```

</Step>
<Step title="Render the spec in your template">

Use `<render-spec>` in your template to render the JSON spec:

```html
<render-spec [spec]="spec" />
```

RenderSpecComponent recursively walks the spec tree, resolves each type
from the registry, and creates Angular components with the specified props.

</Step>
<Step title="Add reactive state">

Use `signalStateStore()` to create a reactive state store that your spec
can bind to:

```typescript
import { signalStateStore } from '@ngaf/render';

const store = signalStateStore({ count: 0, name: '' });
store.set('/count', 1);
store.get('/name'); // Signal<string>
```

</Step>
<Step title="Connect to the LangGraph backend">

Use `agent()` to connect to the agent and display render specs
from the conversation:

```typescript
protected readonly stream = agent({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
});
```

</Step>
</Steps>

<Tip>
RenderSpecComponent is tree-shakeable — only registered component types are included
in your bundle.
</Tip>
