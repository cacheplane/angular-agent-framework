---
workstream: analytics-foundation-1c-cockpit-instrumentation
status: approved
owner: brian
phase: 0
spec: docs/superpowers/specs/gtm/2026-05-15-analytics-foundation-1c-cockpit-instrumentation-design.md
plan: docs/superpowers/plans/gtm/2026-05-15-analytics-foundation-1c-cockpit-instrumentation.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
---

# Analytics Foundation 1C — Cockpit Instrumentation (Design)

> Spec 1C of the Cacheplane GTM motion. Instruments cockpit's three surfaces — the React/Next.js shell, the 32 Angular example apps loaded in iframes, and the cross-frame correlation that ties them into one session — so the developer-funnel dashboard from Spec 1A populates with real cohort data.

## 1. Goal

Wire the activation funnel events for cockpit visitors:
- **Outer (React shell)**: `cockpit:recipe_opened`, `cockpit:mode_switched`, `cockpit:code_copied`
- **Inner (Angular iframe, per example)**: `cockpit:chat_first_message`, `cockpit:transport_connected`, `cockpit:thread_persisted`, `cockpit:interrupt_handled`, `cockpit:generative_component_rendered`
- **Rollup**: `cockpit:activation_complete` when all five inner signals fire within 30 minutes (per-session)

End state: a cockpit visitor evaluating the framework sends one correlated stream of events; PostHog's `activation-funnel` insight reflects real cohort data. Reference example code (what external developers read) stays pristine.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` §7 (analytics architecture).
- Spec 1A (`tools/posthog/`) shipped the dashboards-as-code pipeline + `developer-funnel` dashboard. The activation-funnel insight currently has no real data.
- Spec 1B (`@ngaf/telemetry`) shipped the public telemetry library + trust contract.
- PR #328 (`ba4904f2 feat(telemetry): capture installs from published packages`, on main as of 2026-05-15) made important changes that Spec 1C inherits:
  - `@ngaf/telemetry` no longer bundles `posthog-node`; uses `fetch()` against `apps/website/src/app/api/ingest/route.ts` proxy
  - Every publishable `@ngaf/*` package now fires `ngaf:postinstall` on install
  - `ngaf:postinstall` is anonymous (per-process), package-side, NOT correlatable to cockpit sessions → install signal is a separate top-of-funnel metric, NOT an activation step
  - Trust contract copy unified to "no app telemetry by default" / "package installs send a minimal opt-out ping"
- **Cockpit is internal product**, not a customer-facing library. Different telemetry posture than `@ngaf/*` libs: on by default in production, off on localhost unless explicitly enabled.
- **Example apps are reference code**: external developers read them as the canonical pattern for consuming `@ngaf/chat`, `@ngaf/langgraph`, `@ngaf/render`. Telemetry wiring MUST NOT appear in `main.ts`, `app.config.ts`, or any component the Code mode tab surfaces.

## 3. Scope

**In scope:**

- Three new public `*_LIFECYCLE` `InjectionToken`s in `@ngaf/chat`, `@ngaf/langgraph`, `@ngaf/render` exposing per-instance lifecycle signals. Additive public API; joins the publishable fixed-version group.
- New **private** library `@ngaf/cockpit-telemetry` at `libs/cockpit-telemetry/` (private convention matching existing `@ngaf/cockpit-shell`, `@ngaf/cockpit-ui`, etc. — `"private": true`, not in publishable group, aliased via tsconfig path).
- React shell (`apps/cockpit`) instrumentation: own analytics module mirroring `apps/website/src/lib/analytics/`, uses `posthog-js` directly, fires shell-side events.
- Cross-frame correlation: session UUID generated parent-side, passed to iframe via URL query params.
- Memory-only persistence on BOTH frames — no localStorage, no cookies. Refresh = new session.
- `main.cockpit.ts` build-time entry override per example. Reference source (`main.ts`, `app.config.ts`, components) stays pristine. Each example's `project.json` gains a `cockpit` build configuration.
- One canonical example wired and verified end-to-end: `cockpit/langgraph/streaming/angular/`.
- All 32 examples rolled out in batched per-category commits within this spec's plan.
- Taxonomy + dashboard updates: drop `cockpit:install_command_copied`, rename `cockpit:six_signals_complete` → `cockpit:activation_complete`, rename insight `six-signal-activation-funnel.json` → `activation-funnel.json`, update funnel to 5 steps.
- Per-example smoke test (Chrome MCP) verifying events fire with correct distinct_id.
- Website docs for the three public `*_LIFECYCLE` tokens — final phase of this spec's plan.

**Out of scope:**

- Correlation between `ngaf:postinstall` and cockpit sessions — fundamentally uncorrelatable (different distinct_id sources, anonymous on both sides). `ngaf:postinstall` becomes its own top-of-funnel chart, not an activation step.
- A/B testing, feature flags, experiments in cockpit (deferred — see `gtm.md §11`).
- Persistence across browser refreshes (intentional design — memory-only).
- New cockpit features beyond instrumentation (the 32 example app contents stay the same).
- Marketing-style page analytics (cockpit is an evaluation surface, not a marketing surface).
- Mobile-specific instrumentation paths (mobile users get the same events; no special handling).
- Renaming any `@ngaf/*` libs or restructuring their exports — strictly additive.

## 4. Architecture

### 4.1 Three-surface decomposition

```
┌─────────────────────────────────────────────────────────────────────┐
│ COCKPIT REACT SHELL (apps/cockpit, Next.js)                         │
│                                                                     │
│  posthog-js direct (own client, cockpit's PostHog token)            │
│  session UUID generated parent-side, memory persistence             │
│                                                                     │
│  Events: cockpit:recipe_opened, mode_switched, code_copied          │
│                                                                     │
│  RunMode iframe src = <runtime>?cockpit_did=<UUID>&                 │
│                                  cockpit_cap=<slug>&                │
│                                  cockpit_phk=<token>                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ANGULAR IFRAME (cockpit/<cat>/<cap>/angular)                        │
│                                                                     │
│  main.cockpit.ts ───→  bootstrapWithCockpitHarness()                │
│                          (libs/cockpit-telemetry/src/lib/harness.ts)│
│                                                                     │
│                       Reads URL params → provideCockpitTelemetry()  │
│                       posthog-js direct (same distinct_id as parent)│
│                                                                     │
│  CockpitTelemetryService subscribes to CHAT_LIFECYCLE,              │
│    AGENT_LIFECYCLE, RENDER_LIFECYCLE (all optional injection)       │
│                                                                     │
│  Events: cockpit:chat_first_message, transport_connected,           │
│          thread_persisted, interrupt_handled,                       │
│          generative_component_rendered                              │
│                                                                     │
│  ActivationAggregator: rolls up to cockpit:activation_complete      │
│    when all 5 fire within 30-min window                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Repo layout

```
NEW
├── libs/cockpit-telemetry/                      # @ngaf/cockpit-telemetry (private)
│   ├── src/
│   │   ├── index.ts
│   │   ├── lib/
│   │   │   ├── harness.ts                       # bootstrapWithCockpitHarness()
│   │   │   ├── provide-cockpit-telemetry.ts     # EnvironmentProviders factory
│   │   │   ├── cockpit-telemetry.service.ts     # subscribes to lifecycle tokens
│   │   │   ├── activation-aggregator.ts         # 5-signal rollup → cockpit:activation_complete
│   │   │   ├── distinct-id.ts                   # readCockpitConfigFromIframe()
│   │   │   ├── tokens.ts                        # COCKPIT_TELEMETRY_CONFIG
│   │   │   └── events.ts                        # typed cockpit:* event names
│   │   └── public-api.ts
│   ├── *.spec.ts
│   ├── package.json                              # private: true, @ngaf/cockpit-telemetry
│   ├── project.json
│   ├── tsconfig.json
│   ├── tsconfig.lib.json
│   ├── ng-package.json
│   ├── vite.config.mts
│   └── README.md                                 # internal docs
│
├── apps/cockpit/src/lib/analytics/               # React shell analytics
│   ├── client.ts                                 # posthog-js wrapper
│   ├── events.ts                                 # CockpitShellEvent types
│   ├── distinct-id.ts                            # generates session UUID
│   └── properties.ts                             # shouldCaptureAnalytics helper
│
├── apps/cockpit/instrumentation-client.ts        # Next.js convention — initializes posthog-js for shell
│
MODIFIED
├── libs/chat/src/lib/
│   ├── lifecycle.ts                              # NEW: CHAT_LIFECYCLE token + interface
│   ├── compositions/chat/chat.component.ts       # populates ChatLifecycle
│   └── public-api.ts                             # exports CHAT_LIFECYCLE
│
├── libs/langgraph/src/lib/
│   ├── lifecycle.ts                              # NEW: AGENT_LIFECYCLE token + interface
│   ├── agent.fn.ts                               # populates AgentLifecycle (3 new signals + 5 derived)
│   └── public-api.ts                             # exports AGENT_LIFECYCLE
│
├── libs/render/src/lib/
│   ├── lifecycle.ts                              # NEW: RENDER_LIFECYCLE token + interface
│   ├── render-lifecycle.service.ts               # NEW: subscribes to render-event.ts stream
│   ├── provide-render.ts                         # provides RENDER_LIFECYCLE
│   └── public-api.ts                             # exports RENDER_LIFECYCLE
│
├── apps/cockpit/src/components/sidebar/sidebar.tsx
│   └── fires cockpit:recipe_opened on capability click
│
├── apps/cockpit/src/components/modes/mode-switcher.tsx
│   └── fires cockpit:mode_switched on tab change
│
├── apps/cockpit/src/components/code-mode/code-mode.tsx
│   └── fires cockpit:code_copied on Copy button
│
├── apps/cockpit/src/components/narrative-docs/narrative-docs.tsx
│   └── fires cockpit:code_copied for both code-snippet + agentic-prompt surfaces
│
├── apps/cockpit/src/components/run-mode/run-mode.tsx
│   └── appends cockpit_did/cockpit_cap/cockpit_phk to iframe src
│
├── tsconfig.base.json                            # path alias for @ngaf/cockpit-telemetry
│
├── docs/gtm/taxonomy.md                          # drops cockpit:install_command_copied, renames event
├── tools/posthog/insights/activation-funnel.json # renamed from six-signal-activation-funnel.json; 5 steps
├── tools/posthog/dashboards/developer-funnel.json # references new insight slug
│
└── cockpit/<cat>/<cap>/angular/src/main.cockpit.ts  # NEW per example (32 files, ~5 lines each)
    └── project.json                              # MODIFIED: adds "cockpit" build configuration
```

### 4.3 DI architecture rationale

**Architecture B (lifecycle signals + external adapter).** Libraries expose signals via `InjectionToken`s; an external adapter (`@ngaf/cockpit-telemetry`) subscribes and fires `cockpit:*` events. Reasons:

1. **Namespace correctness** — `cockpit:*` only fires from cockpit-controlled code. Customer apps consuming `@ngaf/chat` never accidentally emit cockpit-funnel events.
2. **Libraries stay pure** — no new dep on `@ngaf/telemetry` for chat/langgraph/render. Bundles don't grow for non-telemetry users.
3. **Composable signal API** — consumers can subscribe to lifecycle for any purpose (debugging, custom dashboards, custom telemetry vendors); telemetry is one possible subscriber.
4. **Iterative-friendly** — adapter ships first, examples adopt incrementally; library changes don't gate adapter rollout.

**Why cockpit-telemetry uses `posthog-js` directly, not `@ngaf/telemetry/browser`:**

- `@ngaf/telemetry/browser` is a customer-facing product telemetry library (its trust contract is "we promise YOUR end-users").
- Cockpit is our own internal product. Different posture.
- Direct posthog-js use mirrors how the React shell will operate; symmetric architecture.
- Avoids adding `distinctId?` config option to `@ngaf/telemetry/browser`'s public API.

## 5. Library lifecycle additions

### 5.1 `CHAT_LIFECYCLE` (`@ngaf/chat`)

```typescript
// libs/chat/src/lib/lifecycle.ts (NEW)
import { InjectionToken, Signal } from '@angular/core';

export interface ChatLifecycle {
  readonly componentReady: Signal<boolean>;
  readonly firstMessageSent: Signal<boolean>;       // sticky for life of <chat>
  readonly messageCount: Signal<number>;            // resets on clearThread
  readonly inputSubmittedAt: Signal<number | null>; // resets on clearThread
}

export const CHAT_LIFECYCLE = new InjectionToken<ChatLifecycle>('CHAT_LIFECYCLE');
```

Wired inside `libs/chat/src/lib/compositions/chat/chat.component.ts`. Provided at component level via `{ provide: CHAT_LIFECYCLE, useValue: lifecycle }`.

Public API additions to `libs/chat/src/public-api.ts`:
- `export { CHAT_LIFECYCLE }`
- `export type { ChatLifecycle }`

**4 new signals, no derived signals.**

### 5.2 `AGENT_LIFECYCLE` (`@ngaf/langgraph`)

```typescript
// libs/langgraph/src/lib/lifecycle.ts (NEW)
export interface AgentLifecycle {
  readonly streamStartedAt: Signal<number | null>;        // derived from status$ → Loading→Success
  readonly streamErrorAt: Signal<{ at: number; classification: string } | null>;  // derived from error$
  readonly interruptReceivedAt: Signal<number | null>;    // derived from interrupt$ first non-null
  readonly interruptResolvedAt: Signal<number | null>;    // NEW: hook in submit({ interrupt }) path
  readonly threadCreatedAt: Signal<number | null>;        // NEW: hook on new thread branch
  readonly threadPersistedAt: Signal<number | null>;      // NEW: hook on existing-threadId restore
  readonly toolCallStartedAt: Signal<number | null>;      // derived from toolCalls$
  readonly toolCallCompletedAt: Signal<number | null>;    // derived from toolCalls$ transition
}

export const AGENT_LIFECYCLE = new InjectionToken<AgentLifecycle>('AGENT_LIFECYCLE');
```

Wired inside `libs/langgraph/src/lib/agent.fn.ts`. The factory builds `AgentLifecycle` alongside the existing BehaviorSubjects + provides it.

**3 new signal hooks + 5 derived from existing BehaviorSubjects.**

`threadPersistedAt` fires on the SECOND load of a thread (proves persistence works from the user's perspective), not on the first save. This is the activation-funnel semantic.

### 5.3 `RENDER_LIFECYCLE` (`@ngaf/render`)

```typescript
// libs/render/src/lib/lifecycle.ts (NEW)
export interface RenderLifecycle {
  readonly firstMountAt: Signal<{ kind: 'spec' | 'element'; elementType?: string; at: number } | null>;
  readonly mountCount: Signal<number>;
  readonly lastMountAt: Signal<number | null>;
  readonly lastStateChangeAt: Signal<number | null>;
  readonly lastHandlerInvokedAt: Signal<{ action: string; at: number } | null>;
}

export const RENDER_LIFECYCLE = new InjectionToken<RenderLifecycle>('RENDER_LIFECYCLE');
```

A new `RenderLifecycleService` (root-scoped, provided by `provideRender()`) subscribes to the existing `RenderEvent` stream from `render-event.ts` and reduces to signals. `firstMountAt` is sticky for the life of the render context.

**0 truly new signals — all 5 derive from the existing event stream.**

## 6. `@ngaf/cockpit-telemetry` internals

### 6.1 Config tokens

```typescript
// libs/cockpit-telemetry/src/lib/tokens.ts
export interface CockpitTelemetryConfig {
  posthogKey: string;              // from URL param cockpit_phk
  posthogHost?: string;            // from cockpit_host or default
  distinctId: string;              // session UUID from parent (cockpit_did)
  capabilitySlug: string;          // e.g. 'langgraph-streaming' (cockpit_cap)
  sampleRate?: number;             // default 1.0
}

export const COCKPIT_TELEMETRY_CONFIG = new InjectionToken<CockpitTelemetryConfig>(
  'COCKPIT_TELEMETRY_CONFIG',
);
```

### 6.2 URL param reader

```typescript
// libs/cockpit-telemetry/src/lib/distinct-id.ts
export function readCockpitConfigFromIframe(): CockpitTelemetryConfig | null {
  const params = new URLSearchParams(window.location.search);
  const distinctId = params.get('cockpit_did');
  const posthogKey = params.get('cockpit_phk');
  const capabilitySlug = params.get('cockpit_cap');
  if (!distinctId || !posthogKey || !capabilitySlug) return null;
  return {
    posthogKey,
    posthogHost: params.get('cockpit_host') ?? 'https://us.i.posthog.com',
    distinctId,
    capabilitySlug,
  };
}
```

### 6.3 Bootstrap harness

```typescript
// libs/cockpit-telemetry/src/lib/harness.ts
export async function bootstrapWithCockpitHarness(
  component: Type<unknown>,
  appConfig: ApplicationConfig,
): Promise<void> {
  const harness = readCockpitConfigFromIframe();
  const providers = harness
    ? [...(appConfig.providers ?? []), provideCockpitTelemetry(harness)]
    : appConfig.providers ?? [];
  await bootstrapApplication(component, { ...appConfig, providers });
}
```

### 6.4 Provider + service

```typescript
// libs/cockpit-telemetry/src/lib/provide-cockpit-telemetry.ts
export function provideCockpitTelemetry(config: CockpitTelemetryConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: COCKPIT_TELEMETRY_CONFIG, useValue: config },
    CockpitTelemetryService,
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useFactory: () => {
        const svc = inject(CockpitTelemetryService);
        return () => svc.init();
      },
    },
  ]);
}
```

The service initializes `posthog-js` with `persistence: 'memory'` + `bootstrap.distinctID` from config, then subscribes to all three lifecycle tokens via `inject(TOKEN, null, { optional: true })`. Each subscription is independent — if a token isn't present in the injector tree, the adapter silently skips it.

Each lifecycle signal transition fires the corresponding `cockpit:*` event AND notifies the aggregator.

### 6.5 Activation aggregator

```typescript
// libs/cockpit-telemetry/src/lib/activation-aggregator.ts
const WINDOW_MS = 30 * 60 * 1000;

type Signal =
  | 'transport_connected'
  | 'chat_first_message'
  | 'thread_persisted'
  | 'interrupt_handled'
  | 'generative_component_rendered';

@Injectable({ providedIn: 'root' })
export class ActivationAggregator {
  // tracks first-signal timestamp + set of seen signals
  // fires cockpit:activation_complete when seen.size === 5 within window
}
```

**5 signals, not 6.** The PR #328-aware decision: `cockpit:install_command_copied` removed (cockpit doesn't surface install commands; `ngaf:postinstall` is the better signal but uncorrelatable to cockpit sessions).

### 6.6 Public API

```typescript
// libs/cockpit-telemetry/src/public-api.ts
export { provideCockpitTelemetry } from './lib/provide-cockpit-telemetry';
export { bootstrapWithCockpitHarness } from './lib/harness';
export { readCockpitConfigFromIframe } from './lib/distinct-id';
export type { CockpitTelemetryConfig } from './lib/tokens';
```

### 6.7 Package manifest

```json
{
  "name": "@ngaf/cockpit-telemetry",
  "version": "0.0.0",
  "license": "MIT",
  "private": true,
  "sideEffects": false,
  "type": "module",
  "peerDependencies": {
    "@angular/core": "^20.0.0 || ^21.0.0"
  },
  "dependencies": {
    "posthog-js": "^1.373.0"
  }
}
```

NOT in `nx.json`'s publishable group. Aliased via `tsconfig.base.json` paths so all 32 examples can `import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry'` without npm publishing.

## 7. React shell instrumentation

### 7.1 Session UUID + memory persistence

```typescript
// apps/cockpit/src/lib/analytics/distinct-id.ts
let cached: string | null = null;

export function getCockpitSessionId(): string {
  if (!cached) cached = `cockpit_${crypto.randomUUID()}`;
  return cached;
}
```

Module-state cache. Refresh = new session. No persistence.

### 7.2 `shouldCaptureAnalytics` helper

```typescript
// apps/cockpit/src/lib/analytics/properties.ts
export interface CaptureGuardInput {
  token: string | undefined;
  captureLocal: boolean;
  host: string | undefined;
  doNotTrack: boolean;
}

export function shouldCaptureAnalytics(input: CaptureGuardInput): boolean {
  if (!input.token) return false;             // no token → no capture
  if (input.doNotTrack) return false;         // DO_NOT_TRACK → opt out
  if (!input.captureLocal && isLocalhost(input.host)) return false;  // localhost gate
  return true;
}

function isLocalhost(host: string | undefined): boolean {
  return host === 'localhost' || host?.startsWith('127.0.0.1') || host?.startsWith('0.0.0.0') || false;
}
```

### 7.3 Instrumentation client

```typescript
// apps/cockpit/instrumentation-client.ts
import posthog from 'posthog-js';
import { getCockpitSessionId } from './src/lib/analytics/distinct-id';
import { shouldCaptureAnalytics } from './src/lib/analytics/properties';

const token = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN;
const captureLocal = process.env.NEXT_PUBLIC_COCKPIT_CAPTURE_LOCAL === 'true';
const host = typeof window === 'undefined' ? undefined : window.location.host;
const doNotTrack = typeof navigator !== 'undefined' && navigator.doNotTrack === '1';

if (shouldCaptureAnalytics({ token, captureLocal, host, doNotTrack })) {
  posthog.init(token!, {
    api_host: process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    persistence: 'memory',
    bootstrap: { distinctID: getCockpitSessionId() },
    autocapture: false,
    capture_pageview: false,
  });
}
```

### 7.4 Iframe src construction

```typescript
// apps/cockpit/src/components/run-mode/run-mode.tsx (modified)
function buildIframeSrc(runtimeUrl: string, capabilitySlug: string): string {
  const url = new URL(runtimeUrl);
  url.searchParams.set('cockpit_did', getCockpitSessionId());
  url.searchParams.set('cockpit_cap', capabilitySlug);
  const phk = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_TOKEN;
  if (phk) url.searchParams.set('cockpit_phk', phk);
  const host = process.env.NEXT_PUBLIC_COCKPIT_POSTHOG_HOST;
  if (host) url.searchParams.set('cockpit_host', host);
  return url.toString();
}
```

### 7.5 Component fire-on-interaction

| Component | File | Event | Properties |
|-----------|------|-------|------------|
| Sidebar | `sidebar/sidebar.tsx` | `cockpit:recipe_opened` | `capability`, `category`, `from_capability` |
| Mode switcher | `modes/mode-switcher.tsx` | `cockpit:mode_switched` | `capability`, `from_mode`, `to_mode` |
| Code mode Copy | `code-mode/code-mode.tsx` | `cockpit:code_copied` | `capability`, `surface: 'code_mode'`, `file_path` |
| Docs code snippet Copy | `narrative-docs/narrative-docs.tsx` | `cockpit:code_copied` | `capability`, `surface: 'docs_code_snippet'`, `file_path` |
| Docs agentic prompt Copy | `narrative-docs/narrative-docs.tsx` | `cockpit:code_copied` | `capability`, `surface: 'agentic_prompt'` |

## 8. `main.cockpit.ts` build override

### 8.1 The pattern

Each Angular example gains a `main.cockpit.ts` sibling to `main.ts`. Cockpit Code mode allowlist excludes `main.cockpit.ts` — external developers see only `main.ts`, `app/*.ts`, `*.md`.

```typescript
// cockpit/langgraph/streaming/angular/src/main.cockpit.ts (NEW per example)
import { StreamingComponent } from './app/streaming.component';
import { appConfig } from './app/app.config';
import { bootstrapWithCockpitHarness } from '@ngaf/cockpit-telemetry';

bootstrapWithCockpitHarness(StreamingComponent, appConfig);
```

If `readCockpitConfigFromIframe()` returns null (no URL params, example opened standalone outside cockpit), the harness bootstraps pristine — telemetry never initializes.

### 8.2 Per-example `project.json` configuration

```jsonc
{
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "configurations": {
        "production": { "browser": "src/main.ts", ... },
        "cockpit":    { "browser": "src/main.cockpit.ts", ... }    // NEW
      }
    },
    "serve": {
      "configurations": {
        "production": { "buildTarget": "...:build:production" },
        "cockpit":    { "buildTarget": "...:build:cockpit" }       // NEW
      }
    }
  }
}
```

### 8.3 Cockpit shell serve targets

The cockpit shell's existing `serve-streaming`, `serve-memory`, etc. targets in `apps/cockpit/project.json` are updated to invoke the `cockpit` configuration:

```jsonc
"serve-streaming": {
  "executor": "@nx/devkit:run-commands",
  "options": {
    "command": "nx run langgraph-streaming-angular:serve:cockpit"
  }
}
```

If an example doesn't have a `cockpit` configuration yet (during incremental rollout), the serve target falls back to the default `serve` (no telemetry, but functional).

## 9. Cross-frame correlation

### 9.1 Session lifecycle

```
1. User opens cockpit                  → getCockpitSessionId() generates "cockpit_<uuid>"
                                         posthog.init(distinct_id="cockpit_<uuid>")

2. User clicks "LangGraph / Streaming" → track('cockpit:recipe_opened', cap=langgraph-streaming)
                                         RunMode renders iframe src with cockpit_did + cockpit_cap

3. Iframe loads main.cockpit.ts        → readCockpitConfigFromIframe() returns harness config
                                         provideCockpitTelemetry called
                                         iframe's posthog.init(distinct_id="cockpit_<uuid>") — SAME

4. User interacts (chat, interrupts)   → CockpitTelemetryService fires cockpit:* events
                                         All share distinct_id="cockpit_<uuid>"

5. User switches recipe                → New iframe src, SAME cockpit_did, NEW cockpit_cap
                                         Session continues; new capability tracked

6. PostHog activation-funnel insight queries by distinct_id → cohort populated
```

### 9.2 Trust + privacy posture

- **Memory persistence on both frames** — no localStorage, no cookies. Refresh = new session.
- **No PII** — events carry only `capability`/`category`/`file_path`/`surface` strings. No user-supplied content.
- **Cockpit's PostHog token in URL param** — public PostHog project key (write-only event ingestion), safe to expose. Same posture as the website's `NEXT_PUBLIC_POSTHOG_TOKEN`.
- **No telemetry on opt-out** — `shouldCaptureAnalytics()` returns false on token unset, localhost (without explicit override), or `navigator.doNotTrack === '1'`.

### 9.3 Telemetry defaults

| Environment | Default state | How to override |
|-------------|---------------|-----------------|
| Production cockpit deploy | **ON** (token env var set, host non-localhost) | n/a |
| Localhost cockpit dev | **OFF** | Set `NEXT_PUBLIC_COCKPIT_CAPTURE_LOCAL=true` |
| Customer's browser with `DO_NOT_TRACK=1` | **OFF** | Disabled by user choice |
| Example loaded standalone (not in iframe) | **OFF** | No URL params; harness bootstraps pristine |

## 10. Testing strategy

### 10.1 Test surfaces + counts

| Surface | Spec files | Tests |
|---------|-----------|-------|
| `libs/chat/src/lib/lifecycle.spec.ts` | 1 | 6 |
| `libs/langgraph/src/lib/lifecycle.spec.ts` | 1 | 10 |
| `libs/render/src/lib/lifecycle.spec.ts` | 1 | 5 |
| `libs/cockpit-telemetry/src/lib/cockpit-telemetry.service.spec.ts` | 1 | 10 |
| `libs/cockpit-telemetry/src/lib/activation-aggregator.spec.ts` | 1 | 6 |
| `libs/cockpit-telemetry/src/lib/distinct-id.spec.ts` | 1 | 4 |
| `libs/cockpit-telemetry/src/lib/harness.spec.ts` | 1 | 3 |
| `libs/cockpit-telemetry/src/lib/browser-silence.spec.ts` | 1 | 1 (permanent) |
| `apps/cockpit/src/lib/analytics/distinct-id.spec.ts` | 1 | 2 |
| `apps/cockpit/src/lib/analytics/client.spec.ts` | 1 | 3 |
| `apps/cockpit/src/lib/analytics/properties.spec.ts` | 1 | 4 |
| Component fire-on-interaction (4 components extended) | 0 new files | 8 |
| Cross-frame correlation | 1 | 3 |
| **Total** | **11 new + 4 modified** | **~65 tests** |

### 10.2 Permanent contract test

`libs/cockpit-telemetry/src/lib/browser-silence.spec.ts` asserts: **when `readCockpitConfigFromIframe()` returns null, `posthog.init()` is never called.** Mirrors `@ngaf/telemetry/browser`'s silence test pattern. Stays green permanently — guards against accidental top-level `import 'posthog-js'` polluting bundles.

### 10.3 Smoke test pattern per example

Per Phase 4 example rollout:
1. `nx run cockpit:serve` + `nx run cockpit:serve-<cap>` locally
2. Chrome MCP navigates to cockpit → clicks capability
3. Interact with chat / interrupt / generative element as appropriate for the capability
4. Read PostHog Live Events via Chrome MCP; confirm expected `cockpit:*` events arrived with matching distinct_id
5. Commit per-example wiring

Dispatched per category as a single subagent run.

### 10.4 CI guard

Small Bash check in `posthog-sync-plan` job (or its own job): assert every cockpit example's `project.json` either has a `cockpit` build configuration OR is listed in a deferred-rollout allowlist. Catches missing wiring during incremental rollout.

## 11. Phases (in this spec's plan)

**Phase 0 — Library lifecycle additions**
- Adds `CHAT_LIFECYCLE`, `AGENT_LIFECYCLE`, `RENDER_LIFECYCLE`
- Lifecycle tests per library (~21 tests)
- Joins the publishable fixed-version group's next bump

**Phase 1 — `@ngaf/cockpit-telemetry` private library**
- Full adapter, harness, activation aggregator, distinct_id parser
- Unit tests + permanent silence test (~24 tests)
- Added to `tsconfig.base.json` path alias
- NOT added to `nx.json` publishable group

**Phase 2 — React shell instrumentation**
- `instrumentation-client.ts`, `apps/cockpit/src/lib/analytics/` module
- Four component instrumentations (sidebar, mode-switcher, code-mode, narrative-docs)
- `RunMode` iframe-src construction
- Tests for components + helpers (~17 tests)

**Phase 3 — Canonical example wired + smoke test**
- `cockpit/langgraph/streaming/angular/src/main.cockpit.ts`
- Updated `project.json` (cockpit config)
- Updated `apps/cockpit/project.json` (serve-streaming uses cockpit config)
- Local Chrome MCP smoke verifying all 5 inner events fire + correlate with parent's distinct_id
- One PR landed; activation funnel begins populating

**Phase 4 — Roll out remaining 31 examples (batched per category)**
- 4 batches: LangGraph (7 remaining), Deep Agents (6), Chat (5), Render + others (~13)
- Each batch: write `main.cockpit.ts` files + project.json tweaks + smoke test the capability
- 4 commits within this plan

**Phase 5 — Website docs for `*_LIFECYCLE` tokens**
- New docs pages at `/docs/<lib>/lifecycle` on cacheplane.ai for chat, langgraph, render
- Each page: typed interface, semantics of each signal, code example for subscribing
- Links from each lib's existing landing page
- Aligns with post-#328 "no app telemetry by default" framing

**Phase 6 — Taxonomy + dashboard JSON cleanup**
- `docs/gtm/taxonomy.md`: remove `cockpit:install_command_copied`, rename `cockpit:six_signals_complete` → `cockpit:activation_complete`
- `tools/posthog/insights/six-signal-activation-funnel.json` → rename to `activation-funnel.json`, update steps to 5
- `tools/posthog/dashboards/developer-funnel.json`: update insight slug reference
- `npm run posthog:sync -- --plan` in CI verifies; one operator `posthog:sync --apply` rolls live PostHog

## 12. Risks & non-goals

### 12.1 Risks

| # | Risk | Mitigation |
|--:|------|------------|
| 1 | Lifecycle signals drift from library behavior in future refactors | Signals populated by same code paths as feature behavior; lib's own tests catch regressions |
| 2 | `cockpit` build configuration breaks an example's standalone deploy | Default `production` config unchanged; `cockpit` is purely additive; smoke test verifies both still work |
| 3 | Cross-frame distinct_id in URL params shows in browser history | UUIDs anonymous + per-session; data is low-value; memory persistence means refresh = new session |
| 4 | Future Angular major version breaks a lifecycle token | Standard Angular DI; bumps follow the existing fixed-group cadence |
| 5 | Example uses something custom (not `@ngaf/chat`) — adapter subscribes to absent token | `injector.get(TOKEN, null, { optional: true })` returns null gracefully; adapter no-ops |
| 6 | Cockpit's posthog token leaks via URL `?cockpit_phk=` | Token is the public PostHog project key (write-only ingestion), safe to expose |
| 7 | 30-minute window math drifts under clock skew | Uses `Date.now()` (epoch ms, monotonic in practice); aggregator resets on stale signal |
| 8 | Phase 4 rollout stalls partway | Examples without `main.cockpit.ts` still work in cockpit (no telemetry, functional); follow-up PRs can complete rollout |
| 9 | `ngaf:postinstall` and `cockpit:*` events are NEVER correlatable | Intentional; documented; `ngaf:postinstall` is a separate top-of-funnel chart, not an activation step |

### 12.2 Non-goals

- No correlation between `ngaf:postinstall` and cockpit sessions (uncorrelatable by design)
- No A/B testing or experiments in cockpit
- No persistence across browser refreshes (memory-only by design)
- No marketing-style page analytics (cockpit is an evaluation surface)
- No automatic example deployment changes (`cockpit` build is build-time only)
- No public API for cockpit-telemetry adapter (private, may break freely)
- No telemetry from cockpit's Next.js API routes (only React shell + iframe instrumented)
- No mobile-specific tracking paths

### 12.3 Deferred (NOT in this spec)

- Outer-shell engagement insights (which capabilities have highest mode-switch rates) — follow-up `dashboards-content` spec
- A/B testing of cockpit copy / layout — `feature-flags-as-code` spec (gtm.md §11)
- New `cockpit:*` events beyond the design — handled by existing event-name pattern as added

## 13. Deliverables of this spec

Plan at `docs/superpowers/plans/gtm/2026-05-15-analytics-foundation-1c-cockpit-instrumentation.md` will check off:

- [ ] **Phase 0:** `CHAT_LIFECYCLE`, `AGENT_LIFECYCLE`, `RENDER_LIFECYCLE` tokens + interfaces + lib internal wiring + tests (~21 tests across 3 libs)
- [ ] **Phase 1:** `libs/cockpit-telemetry/` (private, `@ngaf/cockpit-telemetry`); harness, provider, service, aggregator, distinct-id, tokens; ~24 tests including permanent silence
- [ ] **Phase 1 follow-on:** `tsconfig.base.json` path alias; ng-package.json; project.json; vite.config.mts
- [ ] **Phase 2:** `apps/cockpit/src/lib/analytics/` (distinct-id, client, events, properties); `apps/cockpit/instrumentation-client.ts`; 4 component instrumentations; ~17 tests
- [ ] **Phase 3:** canonical streaming example: `cockpit/langgraph/streaming/angular/src/main.cockpit.ts` + project.json cockpit config; update `apps/cockpit/project.json` serve-streaming; smoke test via Chrome MCP
- [ ] **Phase 4:** 31 remaining examples wired in 4 category batches: LangGraph, Deep Agents, Chat, Render+others
- [ ] **Phase 5:** website docs for the three `*_LIFECYCLE` tokens at `/docs/<lib>/lifecycle`
- [ ] **Phase 6:** `docs/gtm/taxonomy.md` updates; `tools/posthog/insights/activation-funnel.json` (renamed from six-signal-activation-funnel.json, 5 steps); `tools/posthog/dashboards/developer-funnel.json` reference update; CI sync-plan green; operator runs apply

## 14. References

- Parent: [docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md](2026-05-13-gtm-meta-design.md)
- Sibling 1A (shipped): [docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md](2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md)
- Sibling 1B (shipped): [docs/superpowers/specs/gtm/2026-05-15-analytics-foundation-1b-ngaf-telemetry-design.md](2026-05-15-analytics-foundation-1b-ngaf-telemetry-design.md)
- PR #328 (on main as `ba4904f2`): `feat(telemetry): capture installs from published packages` — adds `/api/ingest` proxy, ships `ngaf:postinstall` from every package, drops `posthog-node` from `@ngaf/telemetry`
- Strategy: [gtm.md](../../../../gtm.md)
- Taxonomy: [docs/gtm/taxonomy.md](../../../gtm/taxonomy.md)
- Existing developer-funnel dashboard: `tools/posthog/dashboards/developer-funnel.json`
- Existing cockpit Run mode: `apps/cockpit/src/components/run-mode/run-mode.tsx`
- Existing chat component: `libs/chat/src/lib/compositions/chat/chat.component.ts`
- Existing agent factory: `libs/langgraph/src/lib/agent.fn.ts`
- Existing render event stream: `libs/render/src/lib/render-event.ts`
