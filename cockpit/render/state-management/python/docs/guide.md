# State Management with @ngaf/render

<Summary>
Manage reactive UI state using signalStateStore with JSON Pointer paths.
The store provides get/set/update methods backed by Angular Signals for
automatic UI propagation.
</Summary>

<Prompt>
Add reactive state management to this Angular component using
`signalStateStore()` from `@ngaf/render`. Create a store with
nested state, read values with get(), write with set(), and batch
updates with update().
</Prompt>

<Steps>
<Step title="Create a state store">

Initialize a `signalStateStore()` with your initial state shape:

```typescript
import { signalStateStore } from '@ngaf/render';

const store = signalStateStore({
  user: { name: '', age: 0 },
  settings: { theme: 'dark' },
});
```

</Step>
<Step title="Read values with get()">

Use JSON Pointer paths to read reactive Signal values:

```typescript
const name = store.get('/user/name');   // Signal<string>
const theme = store.get('/settings/theme'); // Signal<string>

// In template: {{ name() }}
```

</Step>
<Step title="Write values with set()">

Set individual values at any path:

```typescript
store.set('/user/name', 'Alice');
store.set('/user/age', 30);
store.set('/settings/theme', 'light');
```

All Signals referencing these paths update automatically.

</Step>
<Step title="Batch updates with update()">

Apply multiple changes atomically:

```typescript
store.update((draft) => {
  draft.user.name = 'Bob';
  draft.user.age = 25;
  draft.settings.theme = 'dark';
});
```

</Step>
<Step title="Bind to render specs">

Render specs can bind props to store paths:

```typescript
const spec = {
  type: 'text',
  props: { content: { bind: '/user/name' } },
};
```

```html
<render-spec [spec]="spec" [store]="store" />
```

</Step>
</Steps>

<Tip>
JSON Pointer paths follow RFC 6901. Use `/` to separate segments:
`/user/name` points to `state.user.name`.
</Tip>
