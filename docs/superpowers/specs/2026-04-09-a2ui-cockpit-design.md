# A2UI Cockpit Integration Design Spec

**Date:** 2026-04-09
**Status:** Approved

## Overview

Add a single A2UI cockpit capability example under `cockpit/chat/a2ui/` demonstrating the full A2UI pipeline: agent streams A2UI JSONL, Angular renders a contact form using `a2uiBasicCatalog()`, user interacts with bound inputs, and button events route back to the agent automatically. Also refactors `ChatComponent` to internalize A2UI event routing — consumers no longer need to manually wire `(renderEvent)` to send A2UI actions back to the agent.

## 1. ChatComponent A2UI Event Routing

### Problem

Today, when an A2UI button fires an `a2ui:event` action, the event flows through the render-lib event system and lands on `ChatComponent`'s `renderEvent` output. The consumer must manually listen and call `agentRef.submit()` to route it back. This is plumbing, not business logic.

### Solution

`ChatComponent` handles `a2ui:event` actions internally. When `onA2uiEvent` receives a `RenderHandlerEvent` with `action === 'a2ui:event'`, it calls `this.ref().submit()` to send the event back to the agent as a human message containing JSON.

```typescript
onA2uiEvent(event: RenderEvent, messageIndex: number, surfaceId: string): void {
  // Auto-route A2UI events back to the agent
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

The `renderEvent` output continues to fire for all events — consumers can observe, log, or override. The built-in routing is the default behavior with no opt-out toggle (YAGNI).

## 2. Cockpit Example: Contact Form

### What It Demonstrates

- Agent emitting A2UI JSONL to build a multi-field form
- Layout components: `Column`, `Card`, `Row`
- Input components: `TextField` (name, email), `ChoicePicker` (department), `CheckBox` (consent)
- Action component: `Button` with `a2ui:event` action for form submission
- Data model binding: all inputs bound via `_bindings`
- Automatic event routing: button click sends event back to agent, agent responds with confirmation

### File Structure

```
cockpit/chat/a2ui/
├── angular/
│   ├── e2e/
│   │   └── a2ui.spec.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.config.ts
│   │   │   └── a2ui.component.ts
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.development.ts
│   │   ├── index.ts
│   │   ├── main.ts
│   │   ├── index.html
│   │   └── styles.css
│   ├── project.json
│   ├── proxy.conf.json
│   ├── tsconfig.json
│   └── tsconfig.app.json
└── python/
    ├── docs/
    │   └── guide.md
    ├── prompts/
    │   └── a2ui.md
    ├── src/
    │   ├── graph.py
    │   └── index.ts
    ├── langgraph.json
    └── pyproject.toml
```

### Angular Component (~15 lines)

```typescript
import { Component } from '@angular/core';
import { ChatComponent, a2uiBasicCatalog } from '@cacheplane/chat';
import { agent } from '@cacheplane/langgraph';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-a2ui',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="agentRef" [views]="catalog" class="block h-screen" />`,
})
export class A2uiComponent {
  protected readonly agentRef = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.a2uiAssistantId,
  });
  protected readonly catalog = a2uiBasicCatalog();
}
```

No `(renderEvent)` handler needed — A2UI events route back automatically.

### Python Agent (graph.py)

A LangGraph `StateGraph` with two nodes:

- **`create_form`** — On first user message, responds with A2UI JSONL containing:
  - `createSurface` with `surfaceId: "contact"`, `catalogId: "basic"`
  - `updateDataModel` with initial empty form state: `{ name: "", email: "", department: "Engineering", consent: false }`
  - `updateComponents` with the form layout: root `Column` > `Card` > `TextField` (name), `TextField` (email), `ChoicePicker` (department), `CheckBox` (consent), `Button` (submit with `a2ui:event` action)

- **`handle_event`** — Receives the routed `a2ui_event` JSON message and responds with a markdown confirmation: "Thanks, {name}! We'll reach out to {email} in the {department} department."

### System Prompt (prompts/a2ui.md)

Documents the A2UI JSONL protocol for the LLM:
- The `---a2ui_JSON---` prefix
- Message types: `createSurface`, `updateComponents`, `updateDataModel`
- Available components (the 18 in the catalog) with their prop signatures
- Data model binding syntax (`{ "path": "/form/name" }`)
- Action types: `event` and `functionCall`

### Guide (python/docs/guide.md)

Follows `<Summary>/<Prompt>/<Steps>` format:
1. Pass `a2uiBasicCatalog()` to `ChatComponent` via `[views]`
2. Configure the Python agent to emit A2UI JSONL
3. How the pipeline works: ContentClassifier → A2uiMessageParser → A2uiSurfaceStore → A2uiSurfaceComponent → render-spec
4. Event routing: button actions automatically flow back to the agent

### E2E Test (e2e/a2ui.spec.ts)

```typescript
test.describe('A2UI Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:XXXX');
    await page.waitForSelector('app-a2ui', { state: 'attached' });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
  });
});
```

### Registration

- `scripts/assemble-examples.ts`: add `{ product: 'chat', topic: 'a2ui' }`
- `vercel.examples.json`: add the entry

## 3. Documentation Updates

### Updated Pages

- **`chat/a2ui/overview.mdx`** — Add section on automatic event routing, update consumer usage example to remove manual `(renderEvent)` wiring for A2UI events
- **Chat component docs** — Note that `a2ui:event` actions are automatically routed back to the agent

## Future Considerations (Out of Scope)

- **Validation execution** — Wiring the `checks` system into catalog input components
- **`sendDataModel` transport** — Built-in mechanism for sending data model state back to agents
- **Additional components** — Expanding the catalog beyond 18
- **`catalogId` routing** — Multi-catalog support
