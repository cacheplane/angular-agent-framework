# Generative UI Spike — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cockpit capability at `cockpit/langgraph/generative-ui/` that proves the streaming generative UI pipeline end-to-end — LLM streams JSON spec tokens → auto-detected → parsed → rendered as Angular components.

**Architecture:** Follow the existing cockpit capability pattern (`cockpit/langgraph/streaming/` as template). Python graph instructs the LLM to return a JSON-render Spec. Angular frontend uses `ChatComponent` with `[views]` input — two simple view components (WeatherCard, StatCard). Registration via manifest + route-resolution.

**Tech Stack:** LangGraph (Python), Angular 20+, `@cacheplane/chat`, `@cacheplane/render`, Tailwind CSS

---

## File Structure

### New Files (Python Backend)

| File | Purpose |
|------|---------|
| `cockpit/langgraph/generative-ui/python/src/graph.py` | LangGraph graph that generates JSON-render Specs |
| `cockpit/langgraph/generative-ui/python/src/index.ts` | Module metadata |
| `cockpit/langgraph/generative-ui/python/prompts/generative-ui.md` | System prompt with Spec schema |
| `cockpit/langgraph/generative-ui/python/docs/guide.md` | Narrative docs |
| `cockpit/langgraph/generative-ui/python/langgraph.json` | LangGraph config |
| `cockpit/langgraph/generative-ui/python/project.json` | Nx project config |

### New Files (Angular Frontend)

| File | Purpose |
|------|---------|
| `cockpit/langgraph/generative-ui/angular/src/app/generative-ui.component.ts` | Main app component with ChatComponent + views |
| `cockpit/langgraph/generative-ui/angular/src/app/app.config.ts` | Angular providers |
| `cockpit/langgraph/generative-ui/angular/src/app/views/weather-card.component.ts` | WeatherCard view component |
| `cockpit/langgraph/generative-ui/angular/src/app/views/stat-card.component.ts` | StatCard view component |
| `cockpit/langgraph/generative-ui/angular/src/main.ts` | Bootstrap |
| `cockpit/langgraph/generative-ui/angular/src/environments/environment.ts` | Production env |
| `cockpit/langgraph/generative-ui/angular/src/environments/environment.development.ts` | Dev env |
| `cockpit/langgraph/generative-ui/angular/src/index.html` | HTML shell |
| `cockpit/langgraph/generative-ui/angular/src/styles.css` | Tailwind + design tokens |
| `cockpit/langgraph/generative-ui/angular/project.json` | Nx Angular app config |
| `cockpit/langgraph/generative-ui/angular/tsconfig.json` | TS config |
| `cockpit/langgraph/generative-ui/angular/tsconfig.app.json` | App TS config |
| `cockpit/langgraph/generative-ui/angular/proxy.conf.json` | Dev proxy |
| `cockpit/langgraph/generative-ui/angular/package.json` | NPM metadata |
| `cockpit/langgraph/generative-ui/angular/vercel.json` | Vercel build config |

### Modified Files (Registration)

| File | Change |
|------|--------|
| `libs/cockpit-registry/src/lib/manifest.ts` | Add `'generative-ui'` to langgraph core-capabilities |
| `apps/cockpit/src/lib/route-resolution.ts` | Import and register the module |

---

### Task 1: Python Backend — Graph + Prompt + Config

**Files:**
- Create: `cockpit/langgraph/generative-ui/python/src/graph.py`
- Create: `cockpit/langgraph/generative-ui/python/prompts/generative-ui.md`
- Create: `cockpit/langgraph/generative-ui/python/langgraph.json`
- Create: `cockpit/langgraph/generative-ui/python/src/index.ts`
- Create: `cockpit/langgraph/generative-ui/python/project.json`
- Create: `cockpit/langgraph/generative-ui/python/docs/guide.md`

- [ ] **Step 1: Create the system prompt**

Create `cockpit/langgraph/generative-ui/python/prompts/generative-ui.md`:

````markdown
# Generative UI Assistant

You are a helpful assistant that responds with structured JSON UI specifications.

When the user asks about weather, locations, or data, respond with a JSON object that follows this exact schema:

```json
{
  "root": "<root-element-key>",
  "elements": {
    "<key>": {
      "type": "<component-type>",
      "props": { ... },
      "children": ["<child-key-1>", "<child-key-2>"]
    }
  }
}
```

## Available component types

### `container`
A layout wrapper that renders its children vertically.
- Props: none required
- Children: array of element keys

### `weather_card`
Displays weather information for a city.
- Props:
  - `city` (string): City name
  - `temperature` (number): Temperature in Fahrenheit
  - `condition` (string): Weather condition (e.g., "Sunny", "Cloudy", "Rainy")

### `stat_card`
Displays a single statistic.
- Props:
  - `label` (string): What the stat measures (e.g., "Humidity", "Wind Speed")
  - `value` (string): The formatted value (e.g., "65%", "12 mph")

## Rules

1. Always respond with ONLY a valid JSON object — no markdown, no explanation, no code fences
2. Use a `container` as the root element when you have multiple components
3. Give each element a unique key (e.g., "root", "weather", "stat-1", "stat-2")
4. Include 2-4 elements total for variety
5. Make the data realistic and varied

## Example response

For "What's the weather in Seattle?":

```json
{
  "root": "root",
  "elements": {
    "root": {
      "type": "container",
      "props": {},
      "children": ["weather", "stat-humidity", "stat-wind"]
    },
    "weather": {
      "type": "weather_card",
      "props": {
        "city": "Seattle",
        "temperature": 58,
        "condition": "Overcast"
      }
    },
    "stat-humidity": {
      "type": "stat_card",
      "props": {
        "label": "Humidity",
        "value": "78%"
      }
    },
    "stat-wind": {
      "type": "stat_card",
      "props": {
        "label": "Wind Speed",
        "value": "8 mph NW"
      }
    }
  }
}
```
````

- [ ] **Step 2: Create the Python graph**

Create `cockpit/langgraph/generative-ui/python/src/graph.py`:

```python
"""
LangGraph Generative UI Graph

A StateGraph that instructs the LLM to return JSON-render Spec objects.
The Angular frontend auto-detects the JSON and renders it as Angular
components via the streaming generative UI pipeline.
"""

from pathlib import Path
from langgraph.graph import StateGraph, MessagesState, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def build_generative_ui_graph():
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def generate(state: MessagesState) -> dict:
        system_prompt = (PROMPTS_DIR / "generative-ui.md").read_text()
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(MessagesState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()


graph = build_generative_ui_graph()
```

- [ ] **Step 3: Create langgraph.json**

Create `cockpit/langgraph/generative-ui/python/langgraph.json`:

```json
{
  "graphs": {
    "generative_ui": "./src/graph.py:graph"
  },
  "dependencies": ["."],
  "python_version": "3.12",
  "env": ".env"
}
```

- [ ] **Step 4: Create module metadata**

Create `cockpit/langgraph/generative-ui/python/src/index.ts`:

```typescript
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'generative-ui';
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

export const langgraphGenerativeUiPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-generative-ui-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'generative-ui',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Generative UI (Python)',
  docsPath: '/docs/langgraph/core-capabilities/generative-ui/overview/python',
  promptAssetPaths: ['cockpit/langgraph/generative-ui/python/prompts/generative-ui.md'],
  codeAssetPaths: [
    'cockpit/langgraph/generative-ui/angular/src/app/generative-ui.component.ts',
    'cockpit/langgraph/generative-ui/angular/src/app/app.config.ts',
    'cockpit/langgraph/generative-ui/angular/src/app/views/weather-card.component.ts',
    'cockpit/langgraph/generative-ui/angular/src/app/views/stat-card.component.ts',
  ],
  backendAssetPaths: [
    'cockpit/langgraph/generative-ui/python/src/graph.py',
  ],
  docsAssetPaths: ['cockpit/langgraph/generative-ui/python/docs/guide.md'],
  runtimeUrl: 'langgraph/generative-ui',
  devPort: 4310,
};
```

- [ ] **Step 5: Create Nx project config**

Create `cockpit/langgraph/generative-ui/python/project.json`:

```json
{
  "name": "cockpit-langgraph-generative-ui-python",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/langgraph/generative-ui/python/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{workspaceRoot}/dist/cockpit/langgraph/generative-ui/python"],
      "options": {
        "outputPath": "dist/cockpit/langgraph/generative-ui/python",
        "main": "cockpit/langgraph/generative-ui/python/src/index.ts",
        "tsConfig": "cockpit/langgraph/generative-ui/python/tsconfig.json"
      }
    },
    "smoke": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "cockpit/langgraph/generative-ui/python",
        "command": "npx tsx -e \"import { langgraphGenerativeUiPythonModule } from './src/index.ts'; const m = langgraphGenerativeUiPythonModule; if (m.id !== 'langgraph-generative-ui-python') { throw new Error('Unexpected module: ' + m.id); }\""
      }
    }
  }
}
```

- [ ] **Step 6: Create docs guide**

Create `cockpit/langgraph/generative-ui/python/docs/guide.md`:

````markdown
# Generative UI

This example demonstrates streaming generative UI — an LLM returns JSON-render Specs that are auto-detected and rendered as Angular components in real time.

## How It Works

1. The LangGraph agent receives a user message
2. The LLM generates a JSON-render Spec as its response (not markdown)
3. Tokens stream to the Angular frontend via SSE
4. `ChatComponent` auto-detects the JSON via `ContentClassifier`
5. `@cacheplane/partial-json` parses the incomplete JSON character-by-character
6. `ParseTreeStore` materializes the parse tree into a `Spec` signal
7. `RenderSpecComponent` renders the spec using the view registry
8. Components update live as tokens arrive — string props grow visibly

## View Components

This example registers two view components:

- **WeatherCard** — Displays city, temperature, and weather condition
- **StatCard** — Displays a label/value pair (humidity, wind speed, etc.)

## Key Code

```typescript
// Register views
const myViews = views({
  weather_card: WeatherCardComponent,
  stat_card: StatCardComponent,
  container: ContainerComponent,
});

// Pass to ChatComponent
<chat [ref]="agentRef" [views]="myViews" />
```

No manual JSON parsing, no content type detection, no spec wiring — the `ChatComponent` handles everything automatically.
````

- [ ] **Step 7: Create Python tsconfig.json**

Create `cockpit/langgraph/generative-ui/python/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 8: Commit**

```bash
git add cockpit/langgraph/generative-ui/python/
git commit -m "feat(cockpit): add generative UI Python graph and module metadata"
```

---

### Task 2: Angular Frontend — View Components + App

**Files:**
- Create: All files under `cockpit/langgraph/generative-ui/angular/`

- [ ] **Step 1: Create WeatherCardComponent**

Create `cockpit/langgraph/generative-ui/angular/src/app/views/weather-card.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  template: `
    <div class="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-white">{{ city() }}</h3>
        <span class="text-2xl">{{ weatherEmoji() }}</span>
      </div>
      <div class="text-4xl font-bold text-white mb-1">{{ temperature() }}°F</div>
      <div class="text-sm text-white/60">{{ condition() }}</div>
    </div>
  `,
})
export class WeatherCardComponent {
  readonly city = input<string>('');
  readonly temperature = input<number>(0);
  readonly condition = input<string>('');

  weatherEmoji(): string {
    const c = this.condition().toLowerCase();
    if (c.includes('sun') || c.includes('clear')) return '☀️';
    if (c.includes('cloud') || c.includes('overcast')) return '☁️';
    if (c.includes('rain')) return '🌧️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('storm') || c.includes('thunder')) return '⛈️';
    return '🌤️';
  }
}
```

- [ ] **Step 2: Create StatCardComponent**

Create `cockpit/langgraph/generative-ui/angular/src/app/views/stat-card.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div class="text-xs font-medium uppercase tracking-wider text-white/40 mb-1">{{ label() }}</div>
      <div class="text-xl font-semibold text-white">{{ value() }}</div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input<string>('');
  readonly value = input<string>('');
}
```

- [ ] **Step 3: Create ContainerComponent**

Create `cockpit/langgraph/generative-ui/angular/src/app/views/container.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';
import { RenderElementComponent } from '@cacheplane/render';

@Component({
  selector: 'app-container',
  standalone: true,
  imports: [RenderElementComponent],
  template: `
    <div class="flex flex-col gap-3">
      @for (key of childKeys(); track key) {
        <render-element [elementKey]="key" [spec]="spec()" />
      }
    </div>
  `,
})
export class ContainerComponent {
  readonly childKeys = input<string[]>([]);
  readonly spec = input.required<Spec>();
}
```

- [ ] **Step 4: Create main app component**

Create `cockpit/langgraph/generative-ui/angular/src/app/generative-ui.component.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Component } from '@angular/core';
import { ChatComponent, views } from '@cacheplane/chat';
import { agent } from '@cacheplane/langgraph';
import { environment } from '../environments/environment';
import { WeatherCardComponent } from './views/weather-card.component';
import { StatCardComponent } from './views/stat-card.component';
import { ContainerComponent } from './views/container.component';

const myViews = views({
  weather_card: WeatherCardComponent,
  stat_card: StatCardComponent,
  container: ContainerComponent,
});

@Component({
  selector: 'app-generative-ui',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="agentRef" [views]="myViews" class="block h-screen" />`,
})
export class GenerativeUiComponent {
  protected readonly agentRef = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.generativeUiAssistantId,
  });

  protected readonly myViews = myViews;
}
```

- [ ] **Step 5: Create app config**

Create `cockpit/langgraph/generative-ui/angular/src/app/app.config.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@cacheplane/langgraph';
import { provideChat } from '@cacheplane/chat';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: environment.langGraphApiUrl }),
    provideChat({}),
  ],
};
```

- [ ] **Step 6: Create bootstrap + environments + config files**

Create `cockpit/langgraph/generative-ui/angular/src/main.ts`:

```typescript
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { GenerativeUiComponent } from './app/generative-ui.component';

bootstrapApplication(GenerativeUiComponent, appConfig).catch(console.error);
```

Create `cockpit/langgraph/generative-ui/angular/src/environments/environment.ts`:

```typescript
export const environment = {
  production: true,
  langGraphApiUrl: '/api',
  generativeUiAssistantId: 'generative_ui',
};
```

Create `cockpit/langgraph/generative-ui/angular/src/environments/environment.development.ts`:

```typescript
export const environment = {
  production: false,
  langGraphApiUrl: 'http://localhost:4310/api',
  generativeUiAssistantId: 'generative_ui',
};
```

Create `cockpit/langgraph/generative-ui/angular/src/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LangGraph Generative UI — Angular</title>
  <base href="/" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 h-screen">
  <app-generative-ui></app-generative-ui>
</body>
</html>
```

Create `cockpit/langgraph/generative-ui/angular/src/styles.css` (copy streaming pattern):

```css
@import "../../../../../libs/design-tokens/src/lib/tokens.css";
@import "tailwindcss";
@source "../../../../../libs/chat/src/";

@theme {
  --color-bg: var(--ds-bg);
  --color-surface: #ffffff;
  --color-accent: var(--ds-accent);
  --color-accent-light: var(--ds-accent-light);
  --color-text-primary: var(--ds-text-primary);
  --color-text-secondary: var(--ds-text-secondary);
  --color-text-muted: var(--ds-text-muted);
  --color-border: var(--ds-accent-border);
  --color-error: #ef4444;
  --color-success: #22c55e;
  --font-sans: var(--ds-font-sans);
  --font-serif: var(--ds-font-serif);
  --font-mono: var(--ds-font-mono);
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--ds-font-sans);
  background: var(--ds-bg);
  color: var(--ds-text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Create `cockpit/langgraph/generative-ui/angular/proxy.conf.json`:

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

Create `cockpit/langgraph/generative-ui/angular/package.json`:

```json
{
  "name": "@cacheplane/cockpit-langgraph-generative-ui-angular",
  "version": "0.0.1",
  "peerDependencies": {
    "@cacheplane/chat": "^0.0.1",
    "@cacheplane/render": "^0.0.1",
    "@cacheplane/langgraph": "^0.0.1",
    "@json-render/core": "^0.16.0",
    "@langchain/langgraph-sdk": "^0.0.36"
  },
  "license": "PolyForm-Noncommercial-1.0.0",
  "sideEffects": false
}
```

Create `cockpit/langgraph/generative-ui/angular/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npx nx build cockpit-langgraph-generative-ui-angular",
  "outputDirectory": "dist/cockpit/langgraph/generative-ui/angular/browser",
  "framework": null
}
```

Create `cockpit/langgraph/generative-ui/angular/tsconfig.json`:

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

Create `cockpit/langgraph/generative-ui/angular/tsconfig.app.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "lib": ["es2022", "dom"],
    "types": [],
    "emitDeclarationOnly": false
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.ts"]
}
```

Create `cockpit/langgraph/generative-ui/angular/project.json`:

```json
{
  "name": "cockpit-langgraph-generative-ui-angular",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/langgraph/generative-ui/angular/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "outputs": ["{options.outputPath.base}"],
      "options": {
        "outputPath": {
          "base": "dist/cockpit/langgraph/generative-ui/angular",
          "browser": ""
        },
        "browser": "cockpit/langgraph/generative-ui/angular/src/main.ts",
        "tsConfig": "cockpit/langgraph/generative-ui/angular/tsconfig.app.json",
        "styles": ["cockpit/langgraph/generative-ui/angular/src/styles.css"]
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
              "replace": "cockpit/langgraph/generative-ui/angular/src/environments/environment.ts",
              "with": "cockpit/langgraph/generative-ui/angular/src/environments/environment.development.ts"
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
        "production": { "buildTarget": "cockpit-langgraph-generative-ui-angular:build:production" },
        "development": { "buildTarget": "cockpit-langgraph-generative-ui-angular:build:development" }
      },
      "defaultConfiguration": "development",
      "options": {
        "proxyConfig": "cockpit/langgraph/generative-ui/angular/proxy.conf.json"
      }
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add cockpit/langgraph/generative-ui/angular/
git commit -m "feat(cockpit): add generative UI Angular frontend with view components"
```

---

### Task 3: Registration — Manifest + Route Resolution

**Files:**
- Modify: `libs/cockpit-registry/src/lib/manifest.ts`
- Modify: `apps/cockpit/src/lib/route-resolution.ts`

- [ ] **Step 1: Add generative-ui to APPROVED_TOPICS**

In `libs/cockpit-registry/src/lib/manifest.ts`, add `'generative-ui'` to the langgraph core-capabilities array:

```typescript
langgraph: {
  'getting-started': ['overview'],
  'core-capabilities': [
    'persistence',
    'durable-execution',
    'streaming',
    'interrupts',
    'memory',
    'subgraphs',
    'time-travel',
    'deployment-runtime',
    'generative-ui',
  ],
},
```

- [ ] **Step 2: Register module in route-resolution.ts**

Add import at the top:

```typescript
import { langgraphGenerativeUiPythonModule } from '../../../../cockpit/langgraph/generative-ui/python/src/index';
```

Add to the `capabilityModules` array:

```typescript
const capabilityModules = [
  // ... existing modules ...
  langgraphGenerativeUiPythonModule,
];
```

- [ ] **Step 3: Verify smoke test passes**

Run: `export PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" && npx nx smoke cockpit-langgraph-generative-ui-python`
Expected: PASS

- [ ] **Step 4: Verify Angular build succeeds**

Run: `export PATH="/Users/blove/.nvm/versions/node/v22.14.0/bin:$PATH" && npx nx build cockpit-langgraph-generative-ui-angular`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add libs/cockpit-registry/ apps/cockpit/
git commit -m "feat(cockpit): register generative-ui capability in manifest and routes"
```
