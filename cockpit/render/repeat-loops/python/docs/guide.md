# Repeat Loops with @cacheplane/render

<Summary>
Iterate over arrays in the state store using repeat specs. Each iteration
provides RepeatScope context with repeatItem, repeatIndex, and repeatBasePath
for per-item rendering.
</Summary>

<Prompt>
Add repeat rendering to this Angular component using repeat specs from
`@cacheplane/render`. Define array state, create a repeat spec template,
access RepeatScope context, and add/remove items dynamically.
</Prompt>

<Steps>
<Step title="Define array state">

Create a state store with an array to iterate over:

```typescript
import { signalStateStore } from '@cacheplane/render';

const store = signalStateStore({
  items: [
    { name: 'Item A', done: false },
    { name: 'Item B', done: true },
    { name: 'Item C', done: false },
  ],
});
```

</Step>
<Step title="Create a repeat spec">

Define a spec with `repeat` pointing to the array path:

```typescript
const spec = {
  type: 'list',
  repeat: '/items',
  children: [
    { type: 'text', props: { content: { bind: 'name' } } },
    { type: 'checkbox', props: { checked: { bind: 'done' } } },
  ],
};
```

</Step>
<Step title="Access RepeatScope context">

Inside repeated components, inject RepeatScope for iteration context:

```typescript
const scope = inject(RepeatScope);
const item = scope.repeatItem;     // current item
const index = scope.repeatIndex;   // zero-based index
const basePath = scope.repeatBasePath; // e.g. '/items/0'
```

</Step>
<Step title="Add and remove items">

Modify the array in the store to add or remove items:

```typescript
// Add an item
store.update((draft) => {
  draft.items.push({ name: 'New Item', done: false });
});

// Remove an item by index
store.update((draft) => {
  draft.items.splice(index, 1);
});
```

</Step>
<Step title="Connect to the backend">

Use `agent()` to receive repeat specs from the agent:

```typescript
protected readonly stream = agent({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
});
```

</Step>
</Steps>

<Tip>
repeatBasePath gives you the JSON Pointer for the current item (e.g. `/items/2`),
so child bindings can use relative paths within each iteration.
</Tip>
