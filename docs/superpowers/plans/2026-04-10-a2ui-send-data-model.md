# A2UI sendDataModel & v0.9 Action Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement v0.9 spec-compliant outbound action messages with `sendDataModel` support, completing the agent-to-UI-to-agent data loop.

**Architecture:** `surfaceToSpec()` resolves event context `DynamicValue`s and threads `sourceComponentId`. `A2uiSurfaceComponent` builds the complete v0.9 `A2uiActionMessage` envelope (including data model when `sendDataModel` is true) and emits it through a dedicated `(action)` output. `ChatComponent` forwards the envelope to the agent. The `(events)` output remains for observation/logging.

**Tech Stack:** Angular 19 (signals, standalone components), TypeScript, Vitest, `@cacheplane/a2ui`, `@cacheplane/chat`, `@cacheplane/render`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `libs/a2ui/src/lib/types.ts` | Add `A2uiActionMessage`, `A2uiClientDataModel` types; update `A2uiSurface` with `sendDataModel` |
| `libs/a2ui/src/index.ts` | Export new types |
| `libs/chat/src/lib/a2ui/surface-store.ts` | Preserve `sendDataModel` flag from `createSurface` |
| `libs/chat/src/lib/a2ui/surface-store.spec.ts` | Test `sendDataModel` preservation |
| `libs/chat/src/lib/a2ui/surface.component.ts` | Resolve context in `surfaceToSpec()`, add `(action)` output, build v0.9 envelope |
| `libs/chat/src/lib/a2ui/surface.component.spec.ts` | Test context resolution, sourceComponentId, action envelope |
| `libs/chat/src/lib/compositions/chat/chat.component.ts` | Add `onA2uiAction()`, simplify `onA2uiEvent()`, bind `(action)` in template |
| `cockpit/chat/a2ui/python/src/graph.py` | Update example: `sendDataModel`, context paths, v0.9 parsing |
| `apps/website/content/docs/chat/a2ui/overview.mdx` | Add events & transport section |
| `apps/website/content/docs/chat/a2ui/catalog.mdx` | Update Button action example |

---

### Task 1: Add v0.9 Action Envelope Types

**Files:**
- Modify: `libs/a2ui/src/lib/types.ts:103-111`
- Modify: `libs/a2ui/src/index.ts:2-10`

- [ ] **Step 1: Add `A2uiClientDataModel` and `A2uiActionMessage` types**

In `libs/a2ui/src/lib/types.ts`, add the following after the `A2uiSurface` interface (after line 111):

```typescript
// --- v0.9 Outbound Action ---

/** v0.9 client data model envelope — attached when sendDataModel is true. */
export interface A2uiClientDataModel {
  version: 'v0.9';
  surfaces: Record<string, Record<string, unknown>>;
}

/** v0.9 outbound action message — sent when a component's event action fires. */
export interface A2uiActionMessage {
  version: 'v0.9';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, unknown>;
  };
  metadata?: {
    a2uiClientDataModel: A2uiClientDataModel;
  };
}
```

- [ ] **Step 2: Add `sendDataModel` to `A2uiSurface`**

In the same file, update the `A2uiSurface` interface (lines 105-111) to include the flag:

```typescript
export interface A2uiSurface {
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  sendDataModel?: boolean;
  components: Map<string, A2uiComponent>;
  dataModel: Record<string, unknown>;
}
```

- [ ] **Step 3: Export new types from public API**

In `libs/a2ui/src/index.ts`, update the type export block (lines 2-10) to include the new types:

```typescript
export type {
  A2uiTheme, A2uiPathRef, A2uiFunctionCall,
  DynamicValue, DynamicString, DynamicNumber, DynamicBoolean, DynamicStringList,
  A2uiChildTemplate, A2uiChildList,
  A2uiEventAction, A2uiLocalAction, A2uiAction, A2uiCheckRule,
  A2uiComponent,
  A2uiCreateSurface, A2uiUpdateComponents, A2uiUpdateDataModel, A2uiDeleteSurface,
  A2uiMessage, A2uiSurface,
  A2uiClientDataModel, A2uiActionMessage,
} from './lib/types';
```

- [ ] **Step 4: Verify build**

Run: `npx nx run a2ui:build`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add libs/a2ui/src/lib/types.ts libs/a2ui/src/index.ts
git commit -m "feat(a2ui): add v0.9 A2uiActionMessage and A2uiClientDataModel types"
```

---

### Task 2: Preserve `sendDataModel` in Surface Store

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface-store.ts:20-28`
- Test: `libs/chat/src/lib/a2ui/surface-store.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to the end of the `describe('createA2uiSurfaceStore', ...)` block in `libs/chat/src/lib/a2ui/surface-store.spec.ts` (before the final `});` on line 99):

```typescript
  it('preserves sendDataModel flag from createSurface', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic', sendDataModel: true });
    expect(store.surfaces().get('s1')!.sendDataModel).toBe(true);
  });

  it('defaults sendDataModel to undefined when not set', () => {
    const store = setup();
    store.apply({ type: 'createSurface', surfaceId: 's1', catalogId: 'basic' });
    expect(store.surfaces().get('s1')!.sendDataModel).toBeUndefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat -- --reporter=default --testPathPattern='surface-store'`
Expected: FAIL — `sendDataModel` is not on the `A2uiSurface` type / property is undefined when expected to be `true`

- [ ] **Step 3: Update the surface store to preserve the flag**

In `libs/chat/src/lib/a2ui/surface-store.ts`, update the `createSurface` case (lines 20-28):

```typescript
      case 'createSurface': {
        const next = new Map(current);
        next.set(message.surfaceId, {
          surfaceId: message.surfaceId,
          catalogId: message.catalogId,
          theme: message.theme,
          sendDataModel: message.sendDataModel,
          components: new Map(),
          dataModel: {},
        });
        surfacesSignal.set(next);
        break;
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- --reporter=default --testPathPattern='surface-store'`
Expected: PASS (all tests including new ones)

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface-store.ts libs/chat/src/lib/a2ui/surface-store.spec.ts
git commit -m "feat(chat): preserve sendDataModel flag in A2UI surface store"
```

---

### Task 3: Resolve Context DynamicValues and Add `sourceComponentId` in `surfaceToSpec()`

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface.component.ts:41-49`
- Test: `libs/chat/src/lib/a2ui/surface.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to the end of `libs/chat/src/lib/a2ui/surface.component.spec.ts` (before the closing of the file):

```typescript
describe('surfaceToSpec — v0.9 event action', () => {
  function makeSurface(components: A2uiComponent[], dataModel: Record<string, unknown> = {}): A2uiSurface {
    const map = new Map<string, A2uiComponent>();
    for (const c of components) map.set(c.id, c);
    return { surfaceId: 's1', catalogId: 'basic', components: map, dataModel };
  }

  it('resolves context DynamicValue paths against data model', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        {
          id: 'btn',
          component: 'Button',
          label: 'Submit',
          action: { event: { name: 'formSubmit', context: { email: { path: '/email' } } } },
        },
      ],
      { email: 'alice@example.com' },
    );
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({ email: 'alice@example.com' });
  });

  it('resolves context FunctionCall values', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        {
          id: 'btn',
          component: 'Button',
          label: 'Format',
          action: { event: { name: 'show', context: { price: { call: 'formatCurrency', args: { value: { path: '/amount' } } } } } },
        },
      ],
      { amount: 42 },
    );
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({ price: '$42.00' });
  });

  it('passes literal context values through unchanged', () => {
    const surface = makeSurface(
      [
        { id: 'root', component: 'Column', children: ['btn'] },
        {
          id: 'btn',
          component: 'Button',
          label: 'Go',
          action: { event: { name: 'navigate', context: { page: 'home' } } },
        },
      ],
    );
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({ page: 'home' });
  });

  it('includes sourceComponentId in event action params', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['submit-btn'] },
      {
        id: 'submit-btn',
        component: 'Button',
        label: 'Submit',
        action: { event: { name: 'formSubmit' } },
      },
    ]);
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['submit-btn'].on!['click'].params;
    expect(params['sourceComponentId']).toBe('submit-btn');
  });

  it('defaults context to empty object when not specified', () => {
    const surface = makeSurface([
      { id: 'root', component: 'Column', children: ['btn'] },
      {
        id: 'btn',
        component: 'Button',
        label: 'Click',
        action: { event: { name: 'clicked' } },
      },
    ]);
    const spec = surfaceToSpec(surface)!;
    const params = spec.elements['btn'].on!['click'].params;
    expect(params['context']).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat -- --reporter=default --testPathPattern='surface.component'`
Expected: FAIL — `sourceComponentId` missing, context values are raw DynamicValue objects instead of resolved

- [ ] **Step 3: Update `surfaceToSpec()` to resolve context and add `sourceComponentId`**

In `libs/chat/src/lib/a2ui/surface.component.ts`, replace lines 42-49:

```typescript
      if ('event' in comp.action) {
        const evt = comp.action.event;
        on = {
          click: {
            action: 'a2ui:event',
            params: { surfaceId: surface.surfaceId, name: evt.name, context: evt.context },
          },
        };
```

With:

```typescript
      if ('event' in comp.action) {
        const evt = comp.action.event;
        const resolvedContext: Record<string, unknown> = {};
        if (evt.context) {
          for (const [key, value] of Object.entries(evt.context)) {
            resolvedContext[key] = resolveDynamic(value, surface.dataModel);
          }
        }
        on = {
          click: {
            action: 'a2ui:event',
            params: {
              surfaceId: surface.surfaceId,
              sourceComponentId: id,
              name: evt.name,
              context: resolvedContext,
            },
          },
        };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- --reporter=default --testPathPattern='surface.component'`
Expected: PASS (all tests including new ones)

- [ ] **Step 5: Update existing test expectations**

The existing test in `surfaceToSpec — action mapping` (line 80-83) checks the old params shape. Update it to match the new shape:

```typescript
    expect(btnElement.on!['click']).toEqual({
      action: 'a2ui:event',
      params: { surfaceId: 's1', sourceComponentId: 'btn', name: 'formSubmit', context: { formId: 'signup' } },
    });
```

- [ ] **Step 6: Run all tests to verify nothing is broken**

Run: `npx nx test chat -- --reporter=default --testPathPattern='surface.component'`
Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface.component.ts libs/chat/src/lib/a2ui/surface.component.spec.ts
git commit -m "feat(chat): resolve context DynamicValues and add sourceComponentId in surfaceToSpec"
```

---

### Task 4: Add `(action)` Output and Build v0.9 Envelope in `A2uiSurfaceComponent`

**Files:**
- Modify: `libs/chat/src/lib/a2ui/surface.component.ts:1-161`
- Test: `libs/chat/src/lib/a2ui/surface.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to the end of `libs/chat/src/lib/a2ui/surface.component.spec.ts`:

```typescript
import { buildA2uiActionMessage } from './surface.component';

describe('buildA2uiActionMessage', () => {
  function makeSurface(
    components: A2uiComponent[],
    dataModel: Record<string, unknown> = {},
    sendDataModel?: boolean,
  ): A2uiSurface {
    const map = new Map<string, A2uiComponent>();
    for (const c of components) map.set(c.id, c);
    return { surfaceId: 's1', catalogId: 'basic', sendDataModel, components: map, dataModel };
  }

  it('builds a v0.9 action message with all required fields', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }]);
    const params = {
      surfaceId: 's1',
      sourceComponentId: 'submit-btn',
      name: 'formSubmit',
      context: { email: 'alice@example.com' },
    };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.version).toBe('v0.9');
    expect(msg.action.name).toBe('formSubmit');
    expect(msg.action.surfaceId).toBe('s1');
    expect(msg.action.sourceComponentId).toBe('submit-btn');
    expect(msg.action.context).toEqual({ email: 'alice@example.com' });
    expect(msg.action.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(msg.metadata).toBeUndefined();
  });

  it('attaches data model when sendDataModel is true', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'Text' }],
      { name: 'Alice', email: 'alice@co.com' },
      true,
    );
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeDefined();
    expect(msg.metadata!.a2uiClientDataModel.version).toBe('v0.9');
    expect(msg.metadata!.a2uiClientDataModel.surfaces['s1']).toEqual({ name: 'Alice', email: 'alice@co.com' });
  });

  it('does not attach data model when sendDataModel is false', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'Text' }],
      { name: 'Alice' },
      false,
    );
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeUndefined();
  });

  it('does not attach data model when sendDataModel is undefined', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }], { name: 'Alice' });
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeUndefined();
  });

  it('defaults context to empty object when not provided in params', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }]);
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'click' } as any;
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.context).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test chat -- --reporter=default --testPathPattern='surface.component'`
Expected: FAIL — `buildA2uiActionMessage` is not exported / does not exist

- [ ] **Step 3: Implement `buildA2uiActionMessage` and add `(action)` output**

In `libs/chat/src/lib/a2ui/surface.component.ts`, update the imports (line 6) to include the new types:

```typescript
import type { A2uiSurface, A2uiChildTemplate, A2uiActionMessage } from '@cacheplane/a2ui';
```

Add the `buildA2uiActionMessage` function after the `surfaceToSpec` function (after line 103):

```typescript
/** Builds a v0.9 A2uiActionMessage from handler params and the current surface. */
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const message: A2uiActionMessage = {
    version: 'v0.9',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId: params['sourceComponentId'] as string,
      timestamp: new Date().toISOString(),
      context: (params['context'] as Record<string, unknown>) ?? {},
    },
  };
  if (surface.sendDataModel) {
    message.metadata = {
      a2uiClientDataModel: {
        version: 'v0.9',
        surfaces: { [surface.surfaceId]: surface.dataModel },
      },
    };
  }
  return message;
}
```

Add the `(action)` output to `A2uiSurfaceComponent` (after line 125):

```typescript
  readonly action = output<A2uiActionMessage>();
```

Update the `a2ui:event` handler in `internalHandlers` (lines 137-139) to build and emit the envelope:

```typescript
      'a2ui:event': (params: Record<string, unknown>) => {
        const message = buildA2uiActionMessage(params, this.surface());
        this.action.emit(message);
        return message;
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx test chat -- --reporter=default --testPathPattern='surface.component'`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/a2ui/surface.component.ts libs/chat/src/lib/a2ui/surface.component.spec.ts
git commit -m "feat(chat): add (action) output and build v0.9 A2uiActionMessage envelope"
```

---

### Task 5: Update `ChatComponent` to Use `(action)` Output

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Modify: `libs/chat/src/public-api.ts` (if `A2uiActionMessage` needs re-export)

- [ ] **Step 1: Add `A2uiActionMessage` import**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, add import at top (after line 16):

```typescript
import type { A2uiActionMessage } from '@cacheplane/a2ui';
```

- [ ] **Step 2: Bind `(action)` in the template**

Update the `<a2ui-surface>` template block (lines 153-158) to bind the new output:

```html
                          <a2ui-surface
                            [surface]="entry.value"
                            [catalog]="catalog"
                            [handlers]="handlers()"
                            (action)="onA2uiAction($event)"
                            (events)="onA2uiEvent($event, index, entry.key)"
                          />
```

- [ ] **Step 3: Add `onA2uiAction` method**

Add the new method to the `ChatComponent` class (before `onA2uiEvent`):

```typescript
  onA2uiAction(message: A2uiActionMessage): void {
    this.ref().submit({
      messages: [{ role: 'human', content: JSON.stringify(message) }],
    });
  }
```

- [ ] **Step 4: Simplify `onA2uiEvent`**

Replace the existing `onA2uiEvent` method (lines 295-314):

```typescript
  onA2uiEvent(event: RenderEvent, messageIndex: number, surfaceId: string): void {
    // Auto-route A2UI event actions back to the agent
    if (event.type === 'handler' && event.action === 'a2ui:event') {
      const params = event.params as Record<string, unknown>;
      this.ref().submit({
        messages: [{
          role: 'human',
          content: JSON.stringify({
            type: 'a2ui_event',
            surfaceId: params['surfaceId'],
            name: params['name'],
            context: params['context'],
          }),
        }],
      });
    }

    // Still emit for consumer observation/logging
    this.renderEvent.emit({ messageIndex, surfaceId, event });
  }
```

With:

```typescript
  onA2uiEvent(event: RenderEvent, messageIndex: number, surfaceId: string): void {
    this.renderEvent.emit({ messageIndex, surfaceId, event });
  }
```

- [ ] **Step 5: Verify build**

Run: `npx nx run chat:build`
Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): route A2UI actions via dedicated (action) output in ChatComponent"
```

---

### Task 6: Update Cockpit Contact Form Example

**Files:**
- Modify: `cockpit/chat/a2ui/python/src/graph.py`

- [ ] **Step 1: Update `createSurface` to include `sendDataModel`**

In `cockpit/chat/a2ui/python/src/graph.py`, update line 15:

```python
CONTACT_FORM_JSONL = A2UI_PREFIX + "\n" + "\n".join([
    json.dumps({"type": "createSurface", "surfaceId": "contact", "catalogId": "basic", "sendDataModel": True}),
```

- [ ] **Step 2: Add context path refs to the submit button action**

Update the `submit_btn` component definition (line 41):

```python
        {"id": "submit_btn", "component": "Button",
         "label": "Submit",
         "action": {"event": {"name": "formSubmit", "context": {
             "name": {"path": "/name"},
             "email": {"path": "/email"},
             "department": {"path": "/department"},
         }}}},
```

- [ ] **Step 3: Update `handle_event` to parse v0.9 envelope**

Replace the `create_form` and `handle_event` functions (lines 53-71):

```python
    async def create_form(state: MessagesState) -> dict:
        last = state["messages"][-1]

        # If this is a v0.9 action message, route to event handling
        try:
            payload = json.loads(last.content)
            if isinstance(payload, dict) and payload.get("version") == "v0.9" and "action" in payload:
                return await handle_event(state, payload)
        except (json.JSONDecodeError, AttributeError):
            pass

        # First message — emit the contact form
        return {"messages": [AIMessage(content=CONTACT_FORM_JSONL)]}

    async def handle_event(state: MessagesState, payload: dict) -> dict:
        action = payload["action"]
        context = action.get("context", {})
        name = context.get("name", "Unknown")
        email = context.get("email", "not provided")
        department = context.get("department", "not specified")

        # Data model is available via metadata when sendDataModel is true
        data_model = (
            payload.get("metadata", {})
            .get("a2uiClientDataModel", {})
            .get("surfaces", {})
            .get(action["surfaceId"], {})
        )

        return {"messages": [AIMessage(
            content=(
                f"Thanks **{name}**! We received your submission:\n\n"
                f"- **Email:** {email}\n"
                f"- **Department:** {department}\n\n"
                f"We'll be in touch soon."
            ),
        )]}
```

- [ ] **Step 4: Verify the cockpit example builds**

Run: `cd cockpit/chat/a2ui/python && python -c "from src.graph import graph; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/a2ui/python/src/graph.py
git commit -m "feat(cockpit): update A2UI contact form with sendDataModel and v0.9 action parsing"
```

---

### Task 7: Update Documentation — Overview

**Files:**
- Modify: `apps/website/content/docs/chat/a2ui/overview.mdx`

- [ ] **Step 1: Add events & transport section**

In `apps/website/content/docs/chat/a2ui/overview.mdx`, add a new section after the existing "Validation" section and before the "What's Next" section:

```markdown
## Events & Data Model Transport

When a user triggers an event action (e.g., clicking a button with `action.event`), the Angular renderer builds a v0.9-compliant action message and sends it back to the agent. Local actions (`action.functionCall`) execute client-side only — the agent never sees them.

### Action Message Shape

The outbound message follows the [v0.9 spec](https://a2ui.org):

```json
{
  "version": "v0.9",
  "action": {
    "name": "formSubmit",
    "surfaceId": "contact",
    "sourceComponentId": "submit-btn",
    "timestamp": "2026-04-10T14:30:00.000Z",
    "context": {
      "name": "Alice",
      "email": "alice@example.com"
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `version` | Always `"v0.9"` |
| `action.name` | The event name from the component's `action.event.name` |
| `action.surfaceId` | The surface that owns this component |
| `action.sourceComponentId` | The `id` of the component that triggered the event |
| `action.timestamp` | ISO 8601 timestamp of when the action was dispatched |
| `action.context` | Resolved values from `action.event.context` — path refs and function calls are evaluated against the current data model |

### Context Resolution

Context values in `action.event.context` are `DynamicValue`s — they can be literals, path references, or function calls. They are resolved at dispatch time against the current data model:

```json
{
  "action": {
    "event": {
      "name": "formSubmit",
      "context": {
        "name": {"path": "/name"},
        "email": {"path": "/email"},
        "total": {"call": "formatCurrency", "args": {"value": {"path": "/amount"}}}
      }
    }
  }
}
```

When the user clicks the button, the renderer resolves `/name` and `/email` from the data model and calls `formatCurrency` on `/amount`, producing a flat `context` object with concrete values.

### sendDataModel

Set `sendDataModel: true` on `createSurface` to attach the full data model snapshot to every outbound action:

```json
{"type": "createSurface", "surfaceId": "contact", "catalogId": "basic", "sendDataModel": true}
```

When enabled, the action message includes a `metadata` field:

```json
{
  "version": "v0.9",
  "action": { "..." : "..." },
  "metadata": {
    "a2uiClientDataModel": {
      "version": "v0.9",
      "surfaces": {
        "contact": {
          "name": "Alice",
          "email": "alice@example.com",
          "department": "Engineering"
        }
      }
    }
  }
}
```

The data model is only sent with event actions — there are no passive change notifications on input changes. This matches the v0.9 spec requirement that the data model piggybacks on outbound messages.

### Angular Integration

`A2uiSurfaceComponent` exposes two outputs:

| Output | Type | Description |
|--------|------|-------------|
| `(action)` | `A2uiActionMessage` | Agent-bound action messages — the complete v0.9 envelope |
| `(events)` | `RenderEvent` | All render events (state changes, handler calls, lifecycle) for observation |

`ChatComponent` auto-routes `(action)` events to the agent as human messages. For standalone usage, bind `(action)` directly:

```html
<a2ui-surface
  [surface]="surface()"
  [catalog]="catalog"
  (action)="sendToAgent($event)"
  (events)="logEvent($event)"
/>
```
```

- [ ] **Step 2: Verify the page builds**

Run: `npx nx build website`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/a2ui/overview.mdx
git commit -m "docs: add A2UI events & data model transport section to overview"
```

---

### Task 8: Update Documentation — Catalog Button

**Files:**
- Modify: `apps/website/content/docs/chat/a2ui/catalog.mdx`

- [ ] **Step 1: Update the Button action examples**

In `apps/website/content/docs/chat/a2ui/catalog.mdx`, replace the action type examples (lines 161-167):

```json
// Emit a named event (sent back to the agent)
{"action": {"event": {"name": "submit", "context": {"formId": "contact"}}}}

// Execute a local function (e.g., open a URL)
{"action": {"functionCall": {"call": "openUrl", "args": {"url": "https://example.com"}}}}
```

With:

```json
// Emit a named event with resolved context (sent back to the agent as v0.9 action)
{"action": {"event": {"name": "submit", "context": {"email": {"path": "/email"}, "formId": "contact"}}}}

// Execute a local function (e.g., open a URL) — agent never sees this
{"action": {"functionCall": {"call": "openUrl", "args": {"url": "https://example.com"}}}}
```

- [ ] **Step 2: Verify the page builds**

Run: `npx nx build website`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/docs/chat/a2ui/catalog.mdx
git commit -m "docs: update Button action examples with context path refs"
```

---

### Task 9: Run Full Test Suite

- [ ] **Step 1: Run all a2ui and chat tests**

Run: `npx nx run-many -t test --projects=a2ui,chat --reporters=default`
Expected: ALL PASS

- [ ] **Step 2: Run website build**

Run: `npx nx build website`
Expected: BUILD SUCCESS

- [ ] **Step 3: Run lint**

Run: `npx nx run-many -t lint --projects=a2ui,chat`
Expected: No errors
