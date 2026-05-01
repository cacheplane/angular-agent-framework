# Computed Functions with @ngaf/render

<Summary>
Define custom functions for prop resolution and data transformation in
render specs. Register functions with provideRender() and reference them
in spec prop expressions for dynamic computed values.
</Summary>

<Prompt>
Add computed functions to this Angular application using `provideRender()`
from `@ngaf/render`. Define custom functions for data formatting,
register them in the render config, and use them in spec props.
</Prompt>

<Steps>
<Step title="Define custom functions">

Create functions for data transformation:

```typescript
const functions = {
  formatDate: (value: string) => new Date(value).toLocaleDateString(),
  uppercase: (value: string) => value.toUpperCase(),
  multiply: (a: number, b: number) => a * b,
};
```

</Step>
<Step title="Register with provideRender">

Pass functions to the provideRender configuration:

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRender({
      functions,
    }),
  ],
};
```

</Step>
<Step title="Use in spec props">

Reference computed functions in render spec prop expressions:

```typescript
const spec = {
  type: 'text',
  props: {
    content: { compute: 'formatDate', args: ['2024-01-15'] },
  },
};
```

</Step>
<Step title="Combine with state">

Computed functions can read from the state store:

```typescript
const spec = {
  type: 'text',
  props: {
    content: { compute: 'uppercase', args: [{ bind: '/user/name' }] },
  },
};
```

</Step>
<Step title="Connect to the backend">

Use `agent()` to receive specs with computed props from the agent:

```typescript
protected readonly stream = agent({
  apiUrl: environment.langGraphApiUrl,
  assistantId: environment.streamingAssistantId,
});
```

</Step>
</Steps>

<Tip>
Keep computed functions pure and side-effect-free. They run during every
change detection cycle, so expensive operations should be memoized.
</Tip>
