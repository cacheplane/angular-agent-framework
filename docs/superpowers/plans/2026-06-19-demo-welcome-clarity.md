# Demo Welcome-Suggestion Clarity + Palette Validation — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the demos' welcome suggestions self-explanatory to a developer (clearer, inferrable titles + a short description per suggestion, surfaced as a multiline dropdown subtitle and a hover tooltip on chips), repo-wide; and stop stale `localStorage` palette values from breaking the demos on a fresh checkout (validate-on-read).

**Design (settled via audit + decisions):**
- **Lib:** `ChatSelectOption` gains an optional `description?: string`; `chat-select` renders it as a subtitle line (multiline option). `chat-welcome-suggestion` (the chip) gains an optional `description?` input rendered as a `title` + `aria-description` **hover/focus tooltip** (no visible subtitle — keeps chips compact). One `description` field serves both surfaces.
- **Copy:** Every welcome suggestion across the 13 apps gets a developer-inferrable title + a 1-line description. Guidelines below.
- **Persistence (Item B):** the two demo palette services validate each read against the current allowed value-set; an unknown/stale value falls back to the default (no versioning).

**Tech Stack:** Angular 21 (signals, `input`), vitest, Nx. No backcompat constraint.

**Audit inventory (the source of truth for which apps/suggestions exist):** see the AP1 repo-wide audit — 13 apps. `examples/chat` (17 suggestions) + `examples/ag-ui` (7) use a featured-chip + `chat-select` "More prompts" dropdown; 11 cockpit apps use plain `chat-welcome-suggestion` chips (1–2 each).

---

## Copy guidelines (apply to every suggestion)

- **Title:** a short, developer-inferrable noun/verb phrase that names the *capability or pattern* being shown (not jargon). Sentence case. Examples: "Consent-gated clear" → **"Clear a day (asks first)"**; "Human approval" → **"Approve before a refund"**; "Demo: render a contact form" → **"Generative UI: contact form"**.
- **Description:** one concise sentence (≤ ~90 chars) saying what the prompt exercises / what the user will see. Example: "Streams a form component the model fills in, then you submit it back."
- **Value (the prompt):** keep existing prompts unless a title change makes a small wording tweak natural; do **not** alter prompts that e2e specs assert on (see Verify).
- Keep capitalization/style consistent across apps.

---

## Task 1: Lib — `ChatSelectOption.description` + multiline option + chip tooltip

**Files:**
- `libs/chat/src/lib/primitives/chat-select/chat-select.component.ts`
- `libs/chat/src/lib/styles/chat-select.styles.ts`
- `libs/chat/src/lib/primitives/chat-welcome/chat-welcome-suggestion.component.ts`
- specs for both components

- [ ] **Step 1 (chat-select):** add `description?: string` to `ChatSelectOption`. Update the option `<button>` template to render a label line + (when present) a description subtitle line:
```html
<button ... class="chat-select__option" ...>
  <span class="chat-select__option-label">{{ opt.label }}</span>
  @if (opt.description) {
    <span class="chat-select__option-desc">{{ opt.description }}</span>
  }
</button>
```
Update `chat-select.styles.ts`: make `.chat-select__option` a vertical flex (`display:flex; flex-direction:column; align-items:flex-start`), add `.chat-select__option-desc` (smaller, `--ngaf-chat-text-muted`/the muted token used elsewhere, `white-space:normal`, `line-height:1.3`, small margin-top). Keep label-only options rendering unchanged (no desc → no subtitle).

- [ ] **Step 2 (chat-welcome-suggestion):** add `readonly description = input<string>()`. In the template, bind it as a tooltip on the button: `[attr.title]="description() || null"` and `[attr.aria-description]="description() || null"`. Do NOT add a visible subtitle (keep the chip compact). Keep `label`/`value`/icon slot unchanged.

- [ ] **Step 3:** Update the existing component specs (`chat-select.component.spec.ts`, `chat-welcome-suggestion.component.spec.ts`): assert an option with a `description` renders the `.chat-select__option-desc` text; assert a chip with `description` sets `title`/`aria-description`; assert absence renders neither (no regression).

- [ ] **Step 4:** `npx nx run-many -t test lint build --projects=chat --skip-nx-cache` — green. Commit:
```bash
git add libs/chat/src/lib/primitives/chat-select libs/chat/src/lib/primitives/chat-welcome libs/chat/src/lib/styles/chat-select.styles.ts
git commit -m "feat(chat): optional description on ChatSelectOption (multiline) + chat-welcome-suggestion (tooltip)"
```

---

## Task 2: examples/* — improved titles + descriptions + wire description through

**Files:**
- `examples/chat/angular/src/app/modes/welcome-suggestions.ts` + `welcome-suggestions.component.ts`
- `examples/ag-ui/angular/src/app/modes/welcome-suggestions.ts` + `welcome-suggestions.component.ts`

- [ ] **Step 1:** Extend the `WelcomeSuggestion` interface in each app to `{ label: string; value: string; description: string }`. Rewrite every suggestion's `label` (per the copy guidelines) and add a `description`. Do NOT change `value` prompts that e2e relies on (the examples/chat `url-routing`/`send-receive` specs and examples/ag-ui specs may assert on sent prompts — check `e2e/*.spec.ts` first; keep those prompt strings intact).
- [ ] **Step 2:** Wire `description` through: in `welcome-suggestions.component.ts`, pass `[description]` to the featured `chat-welcome-suggestion`, and include `description` in the `moreOptions` mapping to `ChatSelectOption[]` (so the dropdown is multiline).
- [ ] **Step 3:** Build both apps: `npx nx run-many -t build --projects=examples-chat-angular,examples-ag-ui-angular --skip-nx-cache` — green.
- [ ] **Step 4:** Commit:
```bash
git add examples/chat/angular/src/app/modes examples/ag-ui/angular/src/app/modes
git commit -m "feat(examples): clearer welcome-suggestion titles + descriptions (multiline dropdown)"
```

---

## Task 3: cockpit/* — improved titles + descriptions (chip tooltips)

**Files (11 apps, inline suggestion arrays in each `*.component.ts`):** tool-calls, subagents, a2ui, interrupts, generative-ui (chat); streaming, interrupts, persistence (langgraph); json-render, a2ui, interrupts (ag-ui). (See the AP1 inventory for each file + current suggestions.)

- [ ] **Step 1:** In each cockpit app's component, the inline suggestions array gains a `description` per item and improved `label`s (copy guidelines). Pass `[description]` to each `chat-welcome-suggestion` chip in the template. Where two apps mirror each other (e.g. chat/interrupts ≈ ag-ui/interrupts), use identical copy.
- [ ] **Step 2:** Build the affected cockpit apps (a representative `nx run-many -t build` across the 11, or `--all` if faster) — green.
- [ ] **Step 3:** Commit:
```bash
git add cockpit
git commit -m "feat(cockpit): clearer welcome-suggestion titles + descriptions (chip tooltips)"
```

---

## Task 4: Item B — validate-on-read in the palette services

**Files:**
- `examples/chat/angular/src/app/shell/palette-persistence.service.ts`
- `examples/ag-ui/angular/src/app/shell/palette-persistence.service.ts`

- [ ] **Step 1:** Each palette service exposes typed reads (model/effort/genUiMode/theme/colorScheme/sidenavMode/etc.). Add a validation layer: for each enum-like field, define the **current allowed value-set** (mirror the dropdown option values the shell already declares — import/reuse them rather than duplicating where possible) and, on read, return the stored value only if it's in the allowed set; otherwise return `undefined` (so the caller's `?? default` kicks in). Non-enum fields (e.g. `selectedProjectId`, free strings, booleans) pass through unchanged. This makes a stale/renamed value (e.g. an old `effort`) fall back to the default instead of loading an invalid selection.
- [ ] **Step 2:** Add/extend the palette service spec: a stored value outside the allowed set reads back as `undefined` (→ default); a valid value reads back unchanged.
- [ ] **Step 3:** Build both apps + run the chat/ag-ui shell specs. Commit:
```bash
git add examples/chat/angular/src/app/shell/palette-persistence.service.ts examples/ag-ui/angular/src/app/shell/palette-persistence.service.ts examples/*/angular/src/app/shell/*.spec.ts
git commit -m "fix(examples): validate palette localStorage reads (stale value → default)"
```

---

## Task 5: Verify + PR

- [ ] **Step 1:** `npx nx run-many -t test lint build --projects=chat --skip-nx-cache`; build all affected example + cockpit apps; run the `examples/chat` + `examples/ag-ui` e2e (free ports first) to confirm no welcome-suggestion/prompt assertion broke. If an e2e asserts a label/prompt that changed, reconcile (prefer keeping the prompt; update the spec only if the label is what's asserted and the new label is correct).
- [ ] **Step 2:** Final review (correctness of the lib option/tooltip change; copy quality + consistency; the palette validation doesn't drop valid values; no e2e regressions).
- [ ] **Step 3:** Regenerate api-docs (chat gained a `description` on `ChatSelectOption` + chip input); commit if changed. Open PR, arm auto-merge, self-healing watcher.

---

## Self-Review
- Coverage: lib option+tooltip (T1); examples copy+wiring (T2); cockpit copy (T3); palette validation (T4); verify+PR (T5). ✓
- Consistency: one `description` field powers both the dropdown subtitle and the chip tooltip; copy guidelines applied uniformly.
- Risk: changing welcome-suggestion `value` prompts could break e2e — explicitly guarded (keep prompts; check specs first). Palette validation must not drop valid values — covered by the spec.
- Conflict-safety vs #685: touches `libs/chat` primitives + example/cockpit apps; does NOT touch `agent.ts`/`public-api` agent exports, so no overlap with the #685 DX branch.
