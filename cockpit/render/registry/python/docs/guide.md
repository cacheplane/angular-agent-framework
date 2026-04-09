# Registry with @cacheplane/render

<Summary>
Map type strings to Angular component classes using defineAngularRegistry.
The registry resolves component types at render time, enabling JSON specs
to reference components by name.
</Summary>

<Prompt>
Add a component registry to this Angular application using
`defineAngularRegistry()` from `@cacheplane/render`. Register component
types, look them up with `registry.get()`, and list all types with
`registry.names()`.
</Prompt>

<Steps>
<Step title="Define your components">

Create simple Angular components that will be registered:

```typescript
@Component({ selector: 'app-card', template: '<div class="card"><ng-content /></div>' })
export class CardComponent {}

@Component({ selector: 'app-badge', template: '<span class="badge">{{ label }}</span>' })
export class BadgeComponent { @Input() label = ''; }
```

</Step>
<Step title="Create a registry with defineAngularRegistry">

Map type strings to component classes:

```typescript
import { defineAngularRegistry } from '@cacheplane/render';

const registry = defineAngularRegistry({
  card: CardComponent,
  badge: BadgeComponent,
});
```

</Step>
<Step title="Use registry.get() to resolve types">

Look up a component class by its type string:

```typescript
const CardClass = registry.get('card');   // CardComponent
const BadgeClass = registry.get('badge'); // BadgeComponent
```

</Step>
<Step title="List registered types with registry.names()">

Get all registered type strings:

```typescript
const types = registry.names(); // ['card', 'badge']
```

</Step>
<Step title="Integrate with provideRender">

Pass the registry to provideRender in your app config:

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRender({ registry }),
  ],
};
```

RenderSpecComponent will use this registry to resolve types in JSON specs.

</Step>
</Steps>

<Tip>
Keep registry entries focused — each type string should map to exactly one
component. Use descriptive names like 'data-table' or 'stat-card' for clarity.
</Tip>
