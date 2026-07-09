# LangGraph Examples Redesign (7 affected) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restyle the **bespoke** UI of the 7 affected langgraph examples off Tailwind utilities (which don't compile in the embedded example builds) onto encapsulated Angular component `styles:` on `--ds-*` design tokens, accent = sky-blue `--ds-accent`. Only the bespoke panels/cards change — the `@threadplane/chat` library UI and `example-chat-layout` are untouched.

**Scope (audited live):** time-travel, durable-execution, persistence (heavy panels), subgraphs, memory (one small container each), interrupts, client-tools (conditional cards). NOT streaming/deployment-runtime (confirmed fine — pure library chat).

**Architecture:** Each example uses `<example-chat-layout>` (library: chat in `main`, bespoke panel projected into `sidebar`; durable-execution + client-tools also register inline chat *views*). Replace the Tailwind/`--tplane-chat-*` styling of the bespoke pieces with encapsulated `styles:` on `--ds-*`. Examples stay standalone — each component carries its own styles (no shared CSS file, per the standalone-examples convention).

**Tech Stack:** Angular standalone + signals, `@threadplane/chat` + `@threadplane/render` view/tool registries, `@threadplane/design-tokens` (`--ds-*`), Nx production build gate (no lint target for example apps).

**Reference exemplar (read first):** `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts` — the encapsulated-`styles:`-on-`--ds-*` approach (BEM-ish classes, `var(--ds-*, fallback)`).

---

## Shared design kit (apply in every task)

**Accent (interactive / primary / selected / active):** sky-blue.
- fill: `var(--ds-accent, #64C3FD)`, hover `var(--ds-accent-hover, #8dd4ff)`, text-on-accent `#08243a` (dark navy — legible on sky-blue).
- soft: bg `var(--ds-accent-surface, rgba(100,195,253,0.08))`, border `var(--ds-accent-border, rgba(100,195,253,0.25))`, text `var(--ds-accent, #64C3FD)`.

**Neutrals:** `--ds-surface`, `--ds-surface-dim`, `--ds-surface-tinted`, `--ds-border`, `--ds-text-primary` / `-secondary` / `-muted`, `--ds-font-mono`, `--ds-radius-sm|md|lg`, `--ds-shadow-md`.

**Semantic status (NO tokens exist — define as local constants in the component's `styles:`):**
```css
:host {
  --st-done: #2ea567;    /* complete / success — green */
  --st-active: #e0a850;  /* running / in-progress — amber */
  --st-error: #e0645a;   /* error — red */
  /* pending / idle → var(--ds-text-muted) */
}
```

**Common class patterns (adapt per example — names illustrative):**
- Panel container: `padding: 1rem;` (sidebar panels).
- `.cap` panel title: `font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:var(--ds-text-muted);` (copy from exemplar).
- `.empty` empty-state: `font-size:13px; font-style:italic; color:var(--ds-text-muted);`.
- `.row` list item: `display:flex; align-items:center; gap:0.5rem; padding:6px 10px; border:1px solid var(--ds-border); border-radius:var(--ds-radius-md); background:var(--ds-surface);` and `.row--active { background:var(--ds-accent-surface); border-color:var(--ds-accent-border); }`.
- `.badge` round: `width:24px; height:24px; border-radius:999px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;` — active/selected: accent fill + `#08243a` text.
- `.btn` small action: `padding:4px 8px; font-size:11px; border-radius:var(--ds-radius-sm); border:1px solid var(--ds-border); background:var(--ds-surface-dim); color:var(--ds-text-secondary); cursor:pointer;` hover → `border-color:var(--ds-accent-border); color:var(--ds-accent);`. `.btn--primary { background:var(--ds-accent); color:#08243a; border:0; font-weight:600; }`.
- Mono id: `font-family:var(--ds-font-mono); font-size:11px; color:var(--ds-text-muted);`.
- status dot: `width:8px; height:8px; border-radius:999px;` colored via `--st-*`.

**Rules (every task):**
- Remove ALL Tailwind utility classes from the bespoke templates. Only plain scoped class names remain.
- Reference `--ds-*` (theme-aware) for neutrals/accent; `--st-*` locals for status. Do NOT reference `--tplane-chat-primary`/`--tplane-chat-surface` (undefined) or Tailwind color names (`bg-green-600` etc.).
- Preserve every handler name, signal, input contract, and `@switch`/`@if`/`@for` logic — only styling changes.
- Do NOT touch `<chat>`, `<chat-approval-card>`, `<chat-welcome-suggestion>`, `<example-chat-layout>` or any `@threadplane/*` library component's own chrome.
- Add `"exclude": ["src/**/*.spec.ts", "src/**/*.test.ts"]` to each example's `tsconfig.app.json` if missing (defensive — matches render fix).
- Per-example gate: no-Tailwind grep (below) + `npx nx build <project> --configuration=production` succeeds.

**No-Tailwind grep template (per file):**
`grep -nE 'class="[^"]*(px-[0-9]|py-[0-9]|p-[0-9]|rounded-|bg-(green|amber|red|blue|indigo|slate|gray|zinc|emerald|purple|sky|teal|orange)-|gap-[0-9]|w-[0-9]|h-[0-9]|border-\[|animate-|space-[xy]-|text-\[|tracking-|font-(semibold|medium|bold))' <file>` → expect no output (exit 1).

---

## Task 1: durable-execution (heavy — step tracker ×2)

**Files:** `cockpit/langgraph/durable-execution/angular/src/app/durable-execution.component.ts`, `.../src/app/views/step-pipeline.component.ts`, `.../tsconfig.app.json`

- [ ] **Step 1: Restyle both step trackers.** Read both files. The main component's `sidebar` has a vertical "Pipeline" step tracker; `step-pipeline.component.ts` is a horizontal inline chat-view of the same. For each step circle use `--st-*`: complete = `--st-done` fill + white check SVG; active = 2px `--st-active` border + `animate` spin (keep the CSS spin animation — define `@keyframes` in the component `styles:`) + small amber dot; pending = 2px `var(--ds-border)` + muted dot. Connecting lines: `--st-done` when prior complete else `var(--ds-border)`. Labels colored per state. Container (inline view): `border:1px solid var(--ds-border); border-radius:var(--ds-radius-xl); padding:1rem; background:var(--ds-surface);`. No interactive controls. Preserve `steps` computed + `StepPipelineComponent` selector `step-pipeline` and its `steps` input.
- [ ] **Step 2: Fix `sidebarWidth`.** In the main component template change `sidebarWidth="w-64"` → `sidebarWidth="16rem"` (Tailwind class was a no-op; input expects a CSS length).
- [ ] **Step 3: tsconfig spec-exclude** (if missing).
- [ ] **Step 4: grep gate** on both `.component.ts` files → no output.
- [ ] **Step 5: build** `npx nx build cockpit-langgraph-durable-execution-angular --configuration=production` → succeeds.
- [ ] **Step 6: commit** `feat(cockpit-langgraph): redesign durable-execution step trackers (encapsulated CSS, --ds-* + semantic status)`

## Task 2: time-travel (heavy — checkpoint timeline)

**Files:** `cockpit/langgraph/time-travel/angular/src/app/time-travel.component.ts`, `.../tsconfig.app.json`

- [ ] **Step 1: Restyle the sidebar timeline.** Header `.cap` "Timeline" + `{{count}} checkpoints` subtitle. Empty state `.empty`. Checkpoint rows as `.row`/`.row--active` (selected). Numbered round `.badge` (selected = accent fill + `#08243a`, else `var(--ds-surface-tinted)` + muted). Label + mono id (truncate: `white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`). Two per-row `.btn` "Replay"/"Fork". Preserve `selectedIndex`, `checkpoints`, `checkpointLabel()`, and the `replay(state,i)` / `fork(state,i)` handlers.
- [ ] **Step 2: tsconfig spec-exclude** (if missing).
- [ ] **Step 3: grep gate** → no output.
- [ ] **Step 4: build** `npx nx build cockpit-langgraph-time-travel-angular --configuration=production` → succeeds.
- [ ] **Step 5: commit** `feat(cockpit-langgraph): redesign time-travel checkpoint timeline (encapsulated CSS on --ds-*)`

## Task 3: persistence (heavy — thread picker)

**Files:** `cockpit/langgraph/persistence/angular/src/app/persistence.component.ts`, `.../tsconfig.app.json`

- [ ] **Step 1: Restyle the sidebar thread picker.** Header `.cap` "Threads". Thread rows as full-width `.thread` buttons (`.thread--active` = `font-weight:600` + `background:var(--ds-accent-surface)`). Footer `.btn--primary` "+ New Thread" (full width). **Replace the inline `(mouseenter)/(mouseleave)` JS style hacks with real CSS `:hover`** (`.thread:hover { background: var(--ds-surface-tinted); }`, `.btn--primary:hover { ... }`) — remove the inline handlers from the template. Preserve `switchThread(id)`, `newThread()`, and the module-scope `threadsState`/`activeThreadIdState` signals + `provideAgent({ onThreadId })` wiring (do NOT touch providers).
- [ ] **Step 2: Fix `sidebarWidth`** `"w-56"` → `"14rem"`.
- [ ] **Step 3: tsconfig spec-exclude** (if missing).
- [ ] **Step 4: grep gate** → no output. Also verify no `mouseenter`/`mouseleave` remain: `grep -c 'mouseenter\|mouseleave' <file>` → 0.
- [ ] **Step 5: build** `npx nx build cockpit-langgraph-persistence-angular --configuration=production` → succeeds.
- [ ] **Step 6: commit** `feat(cockpit-langgraph): redesign persistence thread picker (encapsulated CSS, real :hover)`

## Task 4: subgraphs (small — subagent status list)

**Files:** `cockpit/langgraph/subgraphs/angular/src/app/subgraphs.component.ts`, `.../tsconfig.app.json`

- [ ] **Step 1: Restyle the subagent list.** Container padding. `.cap` "Subagents". `.empty` state. Rows: status `.dot` (`--st-done` complete / `--st-error` error / `--st-active` running) + mono truncated id + right-aligned `.count` msg count (`margin-left:auto; font-size:11px; color:var(--ds-text-muted);`). No controls. Preserve `subagentEntries`.
- [ ] **Step 2: tsconfig spec-exclude** (if missing). **Step 3: grep gate** → no output. **Step 4: build** `npx nx build cockpit-langgraph-subgraphs-angular --configuration=production`. **Step 5: commit** `feat(cockpit-langgraph): redesign subgraphs subagent list (encapsulated CSS on --ds-*)`

## Task 5: memory (small — learned facts list)

**Files:** `cockpit/langgraph/memory/angular/src/app/memory.component.ts`, `.../tsconfig.app.json`

- [ ] **Step 1: Restyle the facts list.** Container padding. `.cap` "Learned Facts". `.empty` state. Fact rows: `.fact__key` (`font-weight:600; color:var(--ds-text-primary);`) + `:` + `.fact__value` (`color:var(--ds-text-secondary);`), `font-size:13px`. Consider a subtle row separator (`border-bottom:1px solid var(--ds-border);`). No controls. Preserve `memoryEntries`.
- [ ] **Step 2: tsconfig spec-exclude** (if missing). **Step 3: grep gate** → no output. **Step 4: build** `npx nx build cockpit-langgraph-memory-angular --configuration=production`. **Step 5: commit** `feat(cockpit-langgraph): redesign memory learned-facts list (encapsulated CSS on --ds-*)`

## Task 6: interrupts (conditional — approval-card body + edit form)

**Files:** `cockpit/langgraph/interrupts/angular/src/app/interrupts.component.ts`, `.../tsconfig.app.json`

- [ ] **Step 1: Restyle the bespoke approval-card body.** This is the content projected into `<chat-approval-card>`'s `#body` ng-template (the card chrome is a library component — DO NOT touch it). Convert the inline `style="..."` attributes to an encapsulated `styles:` block with classes: an Amount row (muted label + `<strong>`), Customer row (muted label + mono `<code>`), optional italic Reason line, and the conditional Edit form (number `<input>` + "Save" button). Style the input on `--ds-*` (`background:var(--ds-surface-dim); border:1px solid var(--ds-border); border-radius:var(--ds-radius-sm); color:var(--ds-text-primary); padding:5px 8px;` + `:focus` accent ring `box-shadow:0 0 0 3px var(--ds-accent-glow); border-color:var(--ds-accent);`) and the Save button as `.btn--primary` (accent fill). Preserve `editing`/`editAmount` signals, `onAction($event)`, `submitEdit(payload)`, `resetEdit()`, and all `agent.submit({ resume })` calls. **Do NOT change any `WELCOME_SUGGESTIONS` label/description text** (asserted by `interrupts.spec.ts` e2e).
- [ ] **Step 2: tsconfig spec-exclude** (if missing). **Step 3: grep gate** → no output (also no leftover `style="..."` on the bespoke body: prefer classes). **Step 4: build** `npx nx build cockpit-langgraph-interrupts-angular --configuration=production`. **Step 5: commit** `feat(cockpit-langgraph): redesign interrupts approval-card body + edit form (encapsulated CSS on --ds-*)`

## Task 7: client-tools (conditional — weather + confirm-booking cards, token remap)

**Files:** `cockpit/langgraph/client-tools/angular/src/app/weather-card.component.ts`, `.../confirm-booking.component.ts`, `.../tsconfig.app.json`

- [ ] **Step 1: Remap the two cards' existing encapsulated styles from `--tplane-chat-*` to `--ds-*`.** These already use encapsulated `styles:` (NOT Tailwind) — this is a token rename, not a conversion. Map: `--tplane-chat-separator`→`var(--ds-border)`, `--tplane-chat-surface*`→`var(--ds-surface)`/`var(--ds-surface-dim)`, `--tplane-chat-text*`→`var(--ds-text-*)`, `--tplane-chat-accent`/`--tplane-chat-primary` (confirm-booking primary button)→`var(--ds-accent)` with `#08243a` text, `--tplane-chat-on-primary`→`#08243a`. Keep card structure, `.wc`/`.cb` classes, the loading badge, the 3-way confirm-booking states. Preserve the schema-anchored `input()`s (`ViewProps<typeof weatherCardSchema>` / `confirmBookingSchema` — `strict:true`, do NOT rename) and `respond(true|false)` → `injectRenderHost().result(...)`. `client-tools.component.ts` itself has no bespoke UI — leave it.
- [ ] **Step 2: tsconfig spec-exclude** (if missing). **Step 3: grep gate** on both card files → no output; also confirm no `--tplane-chat-` remains: `grep -c 'tplane-chat' <both files>` → 0. **Step 4: build** `npx nx build cockpit-langgraph-client-tools-angular --configuration=production`. **Step 5: commit** `feat(cockpit-langgraph): remap client-tool cards to --ds-* tokens (sky-blue accent)`

---

## Task 8: Integration gate (orchestrator)

- [ ] **Build all 7:** `npx nx run-many -t build --configuration=production -p cockpit-langgraph-durable-execution-angular cockpit-langgraph-time-travel-angular cockpit-langgraph-persistence-angular cockpit-langgraph-subgraphs-angular cockpit-langgraph-memory-angular cockpit-langgraph-interrupts-angular cockpit-langgraph-client-tools-angular` → all succeed.
- [ ] **Repo-wide grep** across the 7 examples' component files → no Tailwind utilities remain.

## Task 9: Visual verification (orchestrator, Chrome MCP)

- [ ] **Always-visible panels** — serve each and probe/screenshot (ports in `cockpit/ports.mjs`): durable-execution sidebar tracker, time-travel timeline, persistence thread picker, subgraphs dots, memory facts. Confirm styled (badges/rows/buttons have real radius/padding/accent), light + dark spot-check.
- [ ] **Conditional cards** — best-effort: on the served (or post-deploy production) example, drive the live agent to trigger the interrupt approval card (interrupts) and the weather/confirm-booking tool cards (client-tools) + durable-execution's inline step-pipeline view, and confirm they render styled. If the live backend isn't drivable locally, verify post-deploy on examples.threadplane.ai.

---

## Self-review
- **Coverage:** all 7 audited-affected examples (Tasks 1–7); the 2 fine ones excluded. Semantic status via local `--st-*` (no tokens exist). sidebarWidth no-op fixed (Tasks 1, 3). persistence inline-hover anti-pattern → `:hover` (Task 3). interrupts inline styles → classes (Task 6). client-tools is a token remap not a conversion (Task 7).
- **Preservation:** every task lists the handlers/signals/input contracts to keep; library components explicitly out of bounds.
- **Accent:** sky-blue `--ds-accent` for interactive/primary/selected across all; semantic green/amber/red only for genuine status.
- **No placeholders:** token maps + class patterns concrete; per-example specifics from the live audit + source map.
