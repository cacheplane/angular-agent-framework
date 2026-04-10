# A2UI Cockpit Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an A2UI cockpit capability example and refactor ChatComponent to internalize A2UI event routing back to the agent.

**Architecture:** Modify `ChatComponent.onA2uiEvent()` to auto-route `a2ui:event` actions via `this.ref().submit()`. Then scaffold a new `cockpit/chat/a2ui/` example with Angular app (using `a2uiBasicCatalog()`) and Python LangGraph agent that emits A2UI JSONL for a contact form.

**Tech Stack:** Angular 20+, `@cacheplane/angular`, `@cacheplane/chat`, `@cacheplane/a2ui`, LangGraph Python, Vitest, Playwright

---

### Task 1: Refactor ChatComponent to Auto-Route A2UI Events

**Files:**
- Modify: `libs/chat/src/lib/compositions/chat/chat.component.ts:292-294`

- [ ] **Step 1: Update `onA2uiEvent` to auto-route `a2ui:event` actions**

In `libs/chat/src/lib/compositions/chat/chat.component.ts`, replace the existing `onA2uiEvent` method:

```typescript
// BEFORE (line 292-294):
onA2uiEvent(event: RenderEvent, messageIndex: number, surfaceId: string): void {
  this.renderEvent.emit({ messageIndex, surfaceId, event });
}

// AFTER:
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

- [ ] **Step 2: Run existing tests**

Run: `npx nx test chat`
Expected: All existing tests pass (no behavioral changes to other flows).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/compositions/chat/chat.component.ts
git commit -m "feat(chat): auto-route A2UI event actions back to the agent"
```

---

### Task 2: Scaffold Angular Cockpit App

**Files:**
- Create: `cockpit/chat/a2ui/angular/project.json`
- Create: `cockpit/chat/a2ui/angular/tsconfig.json`
- Create: `cockpit/chat/a2ui/angular/tsconfig.app.json`
- Create: `cockpit/chat/a2ui/angular/proxy.conf.json`
- Create: `cockpit/chat/a2ui/angular/src/index.html`
- Create: `cockpit/chat/a2ui/angular/src/main.ts`
- Create: `cockpit/chat/a2ui/angular/src/styles.css`
- Create: `cockpit/chat/a2ui/angular/src/environments/environment.ts`
- Create: `cockpit/chat/a2ui/angular/src/environments/environment.development.ts`
- Create: `cockpit/chat/a2ui/angular/src/app/app.config.ts`
- Create: `cockpit/chat/a2ui/angular/src/app/a2ui.component.ts`
- Create: `cockpit/chat/a2ui/angular/src/index.ts`

- [ ] **Step 1: Create `project.json`**

```json
{
  "name": "cockpit-chat-a2ui-angular",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/chat/a2ui/angular/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath.base}"],
      "options": {
        "outputPath": {
          "base": "dist/cockpit/chat/a2ui/angular",
          "browser": ""
        },
        "browser": "cockpit/chat/a2ui/angular/src/main.ts",
        "tsConfig": "cockpit/chat/a2ui/angular/tsconfig.app.json",
        "styles": ["cockpit/chat/a2ui/angular/src/styles.css"]
      },
      "configurations": {
        "production": {
          "budgets": [
            { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" },
            { "type": "anyComponentStyle", "maximumWarning": "4kb", "maximumError": "8kb" }
          ],
          "outputHashing": "none"
        },
        "development": {
          "optimization": false,
          "extractLicenses": false,
          "sourceMap": true,
          "fileReplacements": [
            {
              "replace": "cockpit/chat/a2ui/angular/src/environments/environment.ts",
              "with": "cockpit/chat/a2ui/angular/src/environments/environment.development.ts"
            }
          ]
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "configurations": {
        "production": { "buildTarget": "cockpit-chat-a2ui-angular:build:production" },
        "development": { "buildTarget": "cockpit-chat-a2ui-angular:build:development" }
      },
      "defaultConfiguration": "development",
      "options": {
        "proxyConfig": "cockpit/chat/a2ui/angular/proxy.conf.json"
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/chat/a2ui/angular",
        "command": "npx tsx -e \"import { chatA2uiAngularModule } from './src/index.ts'; const module = chatA2uiAngularModule; if (module.id !== 'chat-a2ui-angular' || module.title !== 'Chat A2UI (Angular)') { throw new Error('Unexpected module shape for ' + module.id); }\""
      }
    }
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "noPropertyAccessFromIndexSignature": false,
    "experimentalDecorators": true,
    "module": "preserve",
    "emitDeclarationOnly": false,
    "composite": false,
    "lib": ["es2022", "dom"],
    "skipLibCheck": true,
    "strict": false
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": false,
    "strictInputAccessModifiers": false,
    "strictTemplates": false
  },
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.app.json" }
  ]
}
```

- [ ] **Step 3: Create `tsconfig.app.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts", "src/**/*.ts"]
}
```

- [ ] **Step 4: Create `proxy.conf.json`**

```json
{
  "/api": {
    "target": "http://localhost:8123",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": { "^/api": "" },
    "ws": true
  }
}
```

- [ ] **Step 5: Create `src/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Chat A2UI — Angular</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 h-screen">
  <app-a2ui></app-a2ui>
</body>
</html>
```

- [ ] **Step 6: Create `src/main.ts`**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { A2uiComponent } from './app/a2ui.component';

bootstrapApplication(A2uiComponent, appConfig).catch(console.error);
```

- [ ] **Step 7: Create `src/styles.css`**

```css
/* Global styles for the a2ui capability demo */
```

- [ ] **Step 8: Create `src/environments/environment.ts`**

```typescript
export const environment = {
  production: true,
  langGraphApiUrl: '/api',
  a2uiAssistantId: 'a2ui_form',
};
```

- [ ] **Step 9: Create `src/environments/environment.development.ts`**

```typescript
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4311/api',
  a2uiAssistantId: 'a2ui_form',
};
```

- [ ] **Step 10: Create `src/app/app.config.ts`**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/angular';
import { provideChat } from '@cacheplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
  ],
};
```

- [ ] **Step 11: Create `src/app/a2ui.component.ts`**

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, a2uiBasicCatalog } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';
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

- [ ] **Step 12: Create `src/index.ts` (Angular module metadata)**

```typescript
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'a2ui';
    page: 'overview';
    language: 'angular';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
}

export const chatA2uiAngularModule: CockpitCapabilityModule = {
  id: 'chat-a2ui-angular',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'a2ui',
    page: 'overview',
    language: 'angular',
  },
  title: 'Chat A2UI (Angular)',
  docsPath: '/docs/chat/core-capabilities/a2ui/overview/angular',
  promptAssetPaths: ['cockpit/chat/a2ui/python/prompts/a2ui.md'],
  codeAssetPaths: ['cockpit/chat/a2ui/angular/src/app/a2ui.component.ts'],
};
```

- [ ] **Step 13: Verify the app builds**

Run: `npx nx build cockpit-chat-a2ui-angular`
Expected: Build succeeds, output in `dist/cockpit/chat/a2ui/angular/`

- [ ] **Step 14: Commit**

```bash
git add cockpit/chat/a2ui/angular/
git commit -m "feat(cockpit): scaffold A2UI Angular example app"
```

---

### Task 3: Create Python Agent

**Files:**
- Create: `cockpit/chat/a2ui/python/pyproject.toml`
- Create: `cockpit/chat/a2ui/python/langgraph.json`
- Create: `cockpit/chat/a2ui/python/src/graph.py`
- Create: `cockpit/chat/a2ui/python/src/index.ts`
- Create: `cockpit/chat/a2ui/python/prompts/a2ui.md`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "cockpit-chat-a2ui"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "langgraph>=0.3",
    "langchain-openai>=0.3",
    "langsmith>=0.2",
]

[tool.uv]
dev-dependencies = [
    "langgraph-cli[inmem]>=0.1",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]
```

- [ ] **Step 2: Create `langgraph.json`**

```json
{
  "graphs": {
    "a2ui_form": "./src/graph.py:graph"
  },
  "dependencies": ["."],
  "python_version": "3.12",
  "env": ".env"
}
```

- [ ] **Step 3: Create `prompts/a2ui.md`**

```markdown
# A2UI Form Assistant

You are an assistant that demonstrates the A2UI (Agent-to-UI) protocol.

When the user asks you to create a form, contact card, or any interactive UI,
respond with A2UI JSONL — a sequence of newline-delimited JSON messages prefixed
with `---a2ui_JSON---`.

## A2UI JSONL Format

Your entire response must start with the prefix line, then one JSON message per line:

```
---a2ui_JSON---
{"type":"createSurface","surfaceId":"contact","catalogId":"basic"}
{"type":"updateDataModel","surfaceId":"contact","value":{"name":"","email":"","department":"Engineering","consent":false}}
{"type":"updateComponents","surfaceId":"contact","components":[...]}
```

## Available Components

| Component     | Props                                                           |
|---------------|-----------------------------------------------------------------|
| Column        | children (string[])                                             |
| Row           | children (string[]), gap (string)                               |
| Card          | title (string), children (string[])                             |
| Text          | content (string), variant ("body"\|"caption"\|"heading")        |
| TextField     | label (string), value (string/path), placeholder (string)       |
| ChoicePicker  | label (string), options (string[]), selected (string/path)      |
| CheckBox      | label (string), checked (boolean/path)                          |
| Button        | label (string), variant ("primary"\|"borderless"), action       |
| Divider       | *(none)*                                                        |
| Image         | url (string), alt (string)                                      |
| Icon          | name (string)                                                   |
| List          | children (string[])                                             |
| Tabs          | tabs ({label,childKeys}[]), selected (number)                   |
| Modal         | title (string), open (boolean), children (string[])             |
| Video         | url (string), poster (string), controls (boolean)               |
| AudioPlayer   | url (string), controls (boolean)                                |
| DateTimeInput | label (string), value (string/path), type (date\|time\|datetime-local) |
| Slider        | label (string), value (number/path), min, max, step             |

## Data Model Binding

Use `{"path": "/form/fieldName"}` as a prop value to bind it to the data model.
When the user changes an input, the value at that path updates automatically.

## Actions

Buttons can have an event action that sends data back to the agent:

```json
{"action": {"event": {"name": "formSubmit", "context": {"formId": "contact"}}}}
```

## Rules

1. Always start with `---a2ui_JSON---` on the first line.
2. One JSON message per line, no trailing commas or extra whitespace.
3. Always include `createSurface` first, then `updateDataModel`, then `updateComponents`.
4. Every component referenced in `children` must have a matching `id` in the components array.
5. The root component must have `id: "root"`.
```

- [ ] **Step 4: Create `src/graph.py`**

```python
"""
A2UI Contact Form Graph

Demonstrates the A2UI (Agent-to-UI) protocol by streaming JSONL that
builds an interactive contact form on the Angular frontend.
"""

import json
from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, AIMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

A2UI_PREFIX = "---a2ui_JSON---"

CONTACT_FORM_JSONL = A2UI_PREFIX + "\n" + "\n".join([
    json.dumps({"type": "createSurface", "surfaceId": "contact", "catalogId": "basic"}),
    json.dumps({"type": "updateDataModel", "surfaceId": "contact", "value": {
        "name": "", "email": "", "department": "Engineering", "consent": False,
    }}),
    json.dumps({"type": "updateComponents", "surfaceId": "contact", "components": [
        {"id": "root", "component": "Column", "children": ["card"]},
        {"id": "card", "component": "Card", "title": "Contact Us", "children": [
            "name_field", "email_field", "dept_picker", "consent_check", "divider", "submit_btn",
        ]},
        {"id": "name_field", "component": "TextField",
         "label": "Name", "value": {"path": "/name"}, "placeholder": "Your full name",
         "_bindings": {"value": "/name"}},
        {"id": "email_field", "component": "TextField",
         "label": "Email", "value": {"path": "/email"}, "placeholder": "you@company.com",
         "_bindings": {"value": "/email"}},
        {"id": "dept_picker", "component": "ChoicePicker",
         "label": "Department",
         "options": ["Engineering", "Sales", "Support", "Marketing"],
         "selected": {"path": "/department"},
         "_bindings": {"selected": "/department"}},
        {"id": "consent_check", "component": "CheckBox",
         "label": "I agree to be contacted", "checked": {"path": "/consent"},
         "_bindings": {"checked": "/consent"}},
        {"id": "divider", "component": "Divider"},
        {"id": "submit_btn", "component": "Button",
         "label": "Submit",
         "action": {"event": {"name": "formSubmit", "context": {"formId": "contact"}}}},
    ]}),
])


def build_a2ui_graph():
    """
    Two-node graph:
    - create_form: emits the A2UI contact form surface
    - handle_event: responds to form submission events
    """
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def create_form(state: MessagesState) -> dict:
        last = state["messages"][-1]

        # If this is an a2ui_event, route to event handling
        try:
            payload = json.loads(last.content)
            if isinstance(payload, dict) and payload.get("type") == "a2ui_event":
                return await handle_event(state, payload)
        except (json.JSONDecodeError, AttributeError):
            pass

        # First message — emit the contact form
        return {"messages": [AIMessage(content=CONTACT_FORM_JSONL)]}

    async def handle_event(state: MessagesState, payload: dict) -> dict:
        name = payload.get("context", {}).get("formId", "unknown")
        return {"messages": [AIMessage(
            content=f"Thanks for submitting the **{name}** form! We'll be in touch soon.",
        )]}

    graph = StateGraph(MessagesState)
    graph.add_node("create_form", create_form)
    graph.set_entry_point("create_form")
    graph.add_edge("create_form", END)

    return graph.compile()


graph = build_a2ui_graph()
```

- [ ] **Step 5: Create `src/index.ts` (Python module metadata)**

```typescript
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'chat';
    section: 'core-capabilities';
    topic: 'a2ui';
    page: 'overview';
    language: 'python';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  backendAssetPaths: string[];
  docsAssetPaths: string[];
  runtimeUrl?: string;
  devPort?: number;
}

export const chatA2uiPythonModule: CockpitCapabilityModule = {
  id: 'chat-a2ui-python',
  manifestIdentity: {
    product: 'chat',
    section: 'core-capabilities',
    topic: 'a2ui',
    page: 'overview',
    language: 'python',
  },
  title: 'Chat A2UI (Python)',
  docsPath: '/docs/chat/core-capabilities/a2ui/overview/python',
  promptAssetPaths: ['cockpit/chat/a2ui/python/prompts/a2ui.md'],
  codeAssetPaths: [
    'cockpit/chat/a2ui/angular/src/app/a2ui.component.ts',
    'cockpit/chat/a2ui/angular/src/app/app.config.ts',
  ],
  backendAssetPaths: [
    'cockpit/chat/a2ui/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/chat/a2ui/python/docs/guide.md'],
  runtimeUrl: 'chat/a2ui',
  devPort: 4511,
};
```

- [ ] **Step 6: Commit**

```bash
git add cockpit/chat/a2ui/python/
git commit -m "feat(cockpit): add A2UI Python agent with contact form"
```

---

### Task 4: Create Guide Documentation

**Files:**
- Create: `cockpit/chat/a2ui/python/docs/guide.md`

- [ ] **Step 1: Create `guide.md`**

```markdown
# A2UI Surfaces with @cacheplane/chat

<Summary>
Render agent-driven interactive UI using the A2UI (Agent-to-UI) protocol.
The agent streams JSONL messages that build surfaces from the built-in
18-component catalog — no custom view components needed.
</Summary>

<Prompt>
Add A2UI surface rendering to your chat interface using `a2uiBasicCatalog()`
from `@cacheplane/chat`. Pass it to `ChatComponent` via the `[views]` input
to enable A2UI surface rendering with automatic event routing.
</Prompt>

<Steps>
<Step title="Pass the A2UI catalog to ChatComponent">

Import `a2uiBasicCatalog()` and pass it via the `[views]` input:

```typescript
import { ChatComponent, a2uiBasicCatalog } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';

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

No event handler wiring needed — A2UI button events route back to the
agent automatically.

</Step>
<Step title="Configure the agent to emit A2UI JSONL">

The agent response must start with `---a2ui_JSON---` followed by
newline-delimited JSON messages:

```
---a2ui_JSON---
{"type":"createSurface","surfaceId":"s1","catalogId":"basic"}
{"type":"updateDataModel","surfaceId":"s1","value":{"name":""}}
{"type":"updateComponents","surfaceId":"s1","components":[...]}
```

Three message types build a surface:
1. `createSurface` — initializes the surface
2. `updateDataModel` — sets the initial data model state
3. `updateComponents` — defines the component tree

</Step>
<Step title="Understand the rendering pipeline">

When tokens stream in, `ContentClassifier` detects the `---a2ui_JSON---`
prefix and routes content to the A2UI pipeline:

1. `A2uiMessageParser` extracts complete JSON messages from the stream
2. `A2uiSurfaceStore` applies messages to build `A2uiSurface` objects
3. `A2uiSurfaceComponent` converts each surface to a json-render `Spec`
4. `RenderSpecComponent` renders the spec using the catalog components

</Step>
<Step title="Data model binding">

Components bind to the data model using path references:

```json
{"id": "name_field", "component": "TextField",
 "label": "Name", "value": {"path": "/name"},
 "_bindings": {"value": "/name"}}
```

When the user types in the field, the value at `/name` in the data model
updates automatically via the render-lib StateStore.

</Step>
<Step title="Event routing">

Button actions with `event` type automatically route back to the agent
as a human message containing JSON:

```json
{"type": "a2ui_event", "surfaceId": "s1", "name": "formSubmit", "context": {"formId": "contact"}}
```

The agent receives this and can respond with a new surface, markdown, or
any other content.

</Step>
</Steps>

<Tip>
The 18-component A2UI catalog covers layout (Column, Row, Card), display
(Text, Image, Icon, Divider, List), input (TextField, CheckBox,
ChoicePicker, DateTimeInput, Slider), media (Video, AudioPlayer),
interactive (Button, Tabs, Modal). No custom components are needed for
standard forms and dashboards.
</Tip>
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/a2ui/python/docs/guide.md
git commit -m "docs(cockpit): add A2UI capability guide"
```

---

### Task 5: Create E2E Test

**Files:**
- Create: `cockpit/chat/a2ui/angular/e2e/a2ui.spec.ts`

- [ ] **Step 1: Create the e2e test**

```typescript
import { expect, test } from '@playwright/test';

test.describe('A2UI Example', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4511');
    await page.waitForSelector('app-a2ui', { state: 'attached' });
  });

  test('renders the chat interface', async ({ page }) => {
    await expect(page.locator('chat')).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/chat/a2ui/angular/e2e/
git commit -m "test(cockpit): add A2UI e2e test"
```

---

### Task 6: Register in Build & Deploy Pipeline

**Files:**
- Modify: `scripts/assemble-examples.ts:49`
- Modify: `vercel.examples.json`

- [ ] **Step 1: Add to `scripts/assemble-examples.ts`**

Add after line 49 (`{ product: 'chat', topic: 'theming' },`):

```typescript
  { product: 'chat', topic: 'a2ui' },
```

The `capabilities` array should now have 31 entries.

- [ ] **Step 2: Verify build**

Run: `npx nx build cockpit-chat-a2ui-angular`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add scripts/assemble-examples.ts
git commit -m "ci: register A2UI cockpit in assemble-examples"
```

---

### Task 7: Update A2UI Overview Docs

**Files:**
- Modify: `apps/website/content/docs/chat/a2ui/overview.mdx`

- [ ] **Step 1: Add automatic event routing section**

Add a new section after the existing "Action → Event Binding Bridge" section (or at the end before any closing matter). The section documents that `ChatComponent` auto-routes `a2ui:event` actions:

```mdx
## Automatic Event Routing

When an A2UI button fires an `a2ui:event` action, `ChatComponent` automatically
routes it back to the agent as a human message. No manual `(renderEvent)` wiring
is needed for standard A2UI event flows.

The event is sent as a JSON-encoded human message:

```json
{
  "type": "a2ui_event",
  "surfaceId": "contact",
  "name": "formSubmit",
  "context": { "formId": "contact" }
}
```

The `renderEvent` output still fires for all events, so consumers can observe
or log events without intercepting the routing.

### Minimal Consumer Setup

```typescript
import { ChatComponent, a2uiBasicCatalog } from '@cacheplane/chat';
import { agent } from '@cacheplane/angular';

@Component({
  template: `<chat [ref]="agentRef" [views]="catalog" />`,
})
export class MyComponent {
  agentRef = agent({ apiUrl: '/api', assistantId: 'my-agent' });
  catalog = a2uiBasicCatalog();
}
```
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/content/docs/chat/a2ui/overview.mdx
git commit -m "docs: add automatic event routing section to A2UI overview"
```
