# Canonical `examples/chat` Demo — Smoke fixes (A + B)

**Date:** 2026-05-08
**Status:** Approved
**Builds on:** Phase 1 (PR #213) + Phase 2A (PR #216)
**Surfaced by:** live-Chrome smoke pass against `localhost:4200`

## Goal

Land two small, independent bug fixes that the live smoke pass surfaced. Both are scoped tight enough to ship as a single quick-fix PR, leaving the larger findings (content duplication, thread restoration) for separate brainstorms.

## Findings addressed

### A. Palette dropdowns ignore the signal value on initial render

The control palette renders two `<select>` elements (Model and Effort) with property-bound values:

```html
<select [value]="model()" (change)="pickModel($event)">
  @for (opt of modelOptions(); track opt.value) {
    <option [value]="opt.value">{{ opt.label }}</option>
  }
</select>
```

When the page loads (or reloads), the user sees the *first* option highlighted (`gpt-5`, `minimal (fast)`) regardless of what the signal/persisted state actually is. The bug is that `[value]` on a `<select>` is set declaratively before the `@for` loop materializes `<option>` elements; with no matching option yet present, the select element falls back to its first option, and the binding doesn't re-evaluate when options finally exist.

**Reproduction:**
1. Visit `/embed`.
2. Open the palette dropdown — it shows the first option, even when `localStorage` has a different persisted value.
3. The `(change)` handler still fires correctly when the user picks something, so once changed the persisted value is correct — only the initial render is wrong.

**Fix:** declare option-level `[selected]` bindings that match the current signal value, instead of relying solely on the parent `<select>`'s `[value]`. Angular sets `selected` on each option during the same change-detection pass that populates the `@for`, so the matching option is always selected on first paint.

```html
<select [value]="model()" (change)="pickModel($event)">
  @for (opt of modelOptions(); track opt.value) {
    <option [value]="opt.value" [selected]="opt.value === model()">{{ opt.label }}</option>
  }
</select>
```

Same fix for the Effort dropdown. Two-line change. The `[value]` binding on `<select>` stays for change-detection correctness when the signal updates after render.

### B. Reasoning blocks have empty `summary: []`

The python graph requests reasoning effort but does not request a summary, so the OpenAI Responses API returns `{type: 'reasoning', summary: []}` — a placeholder block with no text content. `<chat-reasoning>` has nothing to render even though the model did reason internally.

**Reproduction:**
1. Set palette: model=`gpt-5`, effort=`high`.
2. Click "Solve a multi-step puzzle (try Effort = high)".
3. Wait for the response.
4. `<chat-reasoning>` element is absent from the DOM (`document.querySelector('chat-reasoning') === null`).
5. Server-side check: `curl /threads/<id>/state | jq '.values.messages[-1].content'` shows `[{type:'reasoning', summary:[]}, {type:'text', text:'…'}]`.

**Fix:** extend the `kwargs["reasoning"]` dict in `generate()` to also request an auto-generated summary:

```python
kwargs["reasoning"] = {"effort": effort, "summary": "auto"}
```

This is the OpenAI Responses API contract for getting summarized reasoning text in the streamed response. With `summary: "auto"`, gpt-5/o-series models return reasoning blocks whose `summary` field is a list of paragraph-shape items (`[{type: 'summary_text', text: '...'}, ...]`).

The `@ngaf/langgraph` adapter's `extractReasoning` helper currently looks for `block.text` on reasoning blocks and ignores `block.summary`. We need to extend it to also extract from `summary` items.

**Fix in adapter** — `libs/langgraph/src/lib/internals/stream-manager.bridge.ts`, the `extractReasoning(content)` helper:

```ts
function extractReasoning(content: unknown): string {
  if (typeof content === 'string') return '';
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const block of content) {
    if (block == null || typeof block !== 'object') continue;
    const rec = block as Record<string, unknown>;
    const t = rec['type'];
    if (t === 'reasoning' || t === 'thinking') {
      // Direct text field (Anthropic-style "thinking" blocks, some
      // LangChain-shaped reasoning blocks).
      const text = rec['text'];
      if (typeof text === 'string') out += text;
      // OpenAI Responses API: reasoning blocks carry an array of
      // summary items when `reasoning.summary='auto'` was requested.
      // Each item is { type: 'summary_text', text: '...' }.
      const summary = rec['summary'];
      if (Array.isArray(summary)) {
        for (const item of summary) {
          if (item != null && typeof item === 'object') {
            const itemText = (item as Record<string, unknown>)['text'];
            if (typeof itemText === 'string') out += itemText;
          }
        }
      }
    }
  }
  return out;
}
```

This is back-compatible — existing reasoning shapes that use `block.text` directly still work; the new `block.summary[].text` path is additive.

A unit test at `stream-manager.bridge.spec.ts` pins the behavior:

```ts
it('extractReasoning pulls text from OpenAI summary items', () => {
  const content = [
    { type: 'reasoning', summary: [
      { type: 'summary_text', text: 'First thought. ' },
      { type: 'summary_text', text: 'Second thought.' },
    ]},
    { type: 'text', text: 'Visible answer' },
  ];
  expect(extractReasoning(content)).toBe('First thought. Second thought.');
});
```

## Scope

This batch is **two independent fixes**:

1. **examples/chat/angular**: declarative `[selected]` on palette dropdown options.
2. **examples/chat/python + libs/langgraph**: request reasoning summary; adapter extracts summary text.

Out of scope (deferred to separate specs):

- Finding **C** (visible answer rendered duplicated) — adapter content-accumulation issue, needs its own brainstorm.
- Finding **D** (thread NOT restored after reload) — SDK reconnect behavior, separate brainstorm.
- Finding **E** (regenerate visual flicker) — likely a side-effect of C; revisit after C lands.
- Finding **F** (two empty `<chat-error>` elements) — cosmetic; defer.
- Anthropic thinking-block handling (already works through `block.text`).

## Files touched

| Path | Change |
|---|---|
| `examples/chat/angular/src/app/shell/control-palette.component.html` | +2 `[selected]` bindings on the two dropdown options |
| `examples/chat/python/src/graph.py` | +1 key in the `reasoning` kwargs dict |
| `libs/langgraph/src/lib/internals/stream-manager.bridge.ts` | extend `extractReasoning` to read `summary` items |
| `libs/langgraph/src/lib/internals/stream-manager.bridge.spec.ts` | +1 unit test for the summary path |

Total ≈ 25 LOC.

Note on the libs/langgraph change: this lands in the library, which means the demo at `examples/chat/angular/` (workspace-linked) picks it up immediately. The smoke template at `examples/chat/smoke/template/` consumes the published `@ngaf/langgraph` package, so the smoke template's behavior won't reflect the fix until a new `@ngaf/*` patch ships. This is fine — the demo is the canonical surface; the smoke-template lag matches the existing release cadence.

## Definition of done

1. PR merged.
2. CI green: `examples-chat-angular:test`, `examples-chat-angular:build`, `langgraph:test`, `examples-chat-python:smoke`.
3. Local smoke (re-run against the workspace demo, NOT the smoke template):
   - Open `/embed`. Palette shows `gpt-5-mini` (signal default) on first load — NOT `gpt-5`.
   - Reload the page after changing model to `gpt-5-nano`. Palette shows `gpt-5-nano`.
   - Set effort to `medium` and reload. Palette shows `medium`.
   - With model = `gpt-5`, effort = `high`, send the puzzle prompt. After streaming completes:
     - `<chat-reasoning>` element renders.
     - The pill shows "Thought for {duration}".
     - Click pill → reasoning text expands (the OpenAI summary items).

## Risks

- `[selected]` on `<option>` interacts with `<select>`'s `[value]` binding. Angular generally handles both — the `<select>` `value` property wins after both run, and `selected` ensures correct paint when the parent `[value]` fires before `@for` materializes options. If a regression surfaces (e.g. selecting a value that doesn't match any option), the symptom would be "no option selected" — easy to spot during smoke.
- `summary: "auto"` on a non-reasoning model (e.g. gpt-4) is silently ignored by the OpenAI API. Existing fallback path (no `kwargs["reasoning"]` for non-reasoning models) is unchanged.
- The adapter's `extractReasoning` extension is additive: existing `block.text` paths still work. Existing reasoning specs in `stream-manager.bridge.spec.ts` should remain green.
