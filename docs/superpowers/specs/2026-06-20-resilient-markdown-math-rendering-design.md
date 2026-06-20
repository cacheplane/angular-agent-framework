# Resilient markdown + math rendering — Design

**Status:** Approved (brainstorm 2026-06-20)

**Goal:** Stop LaTeX/math from leaking as raw text in the chat stream, and make the streaming markdown parser more durable against partial/adversarial input. Two bounded efforts in two repos.

## Background

The chat lib renders streaming assistant text through `chat-streaming-md`, which walks a `@cacheplane/partial-markdown` AST (incremental, identity-stable across pushes) and maps node types to Angular view components via the markdown view registry.

**Observed leak (2026-06-20, live in examples/ag-ui):** model output containing `$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$` (and `$$…$$`) renders the raw LaTeX — `$` delimiters and `\frac`/`\sqrt` commands print literally instead of as math. Inline code (`` `npm install` ``) renders correctly.

**Root cause — verified 2026-06-20 against the *published* package (corrected from the original brainstorm):**
1. The **published** `@cacheplane/partial-markdown` the chat lib consumes (`"^0.3.0"`, npm max `0.3.2`) has **no math support at all** — the published `0.3.2` tarball contains zero `math-inline`/`dollar` references. The math handler (`handlers/math.ts`, the `{ math: { dollar } }` option, `math-inline`/`math-display` nodes) exists **only in unreleased cacheplane source at `0.4.1`** (`feat: add math parsing #10`), committed but never tagged/published. So `createPartialMarkdownParser()` against the installed build emits `$x$` as a plain `text` node; passing `{ math: { dollar: true } }` to it would be a silent no-op.
2. The chat lib's markdown view registry also has **no view component** for `math-inline`/`math-display`. The child renderer (`md-children`) renders **nothing** for an unregistered node type.

The leak therefore has a **library-release dependency** (math is built but unpublished — call it **A.0**) **plus** a chat-side wiring gap. Consequence: the dep bump and the math view must ship in the **same chat PR** — bumping alone would convert the raw-`$` leak into *blank* math. Separately, we want to harden the parser library for streaming durability (Part B).

## Part A — math rendering (a cacheplane release + chat-side wiring)

Fixes the visible leak. Requires **A.0** (release the already-built math handler) before the chat-side steps; does **not** require Part B's hardening.

### A.0 — Release `@cacheplane/partial-markdown` with math (cacheplane repo)
The math handler is already committed and at version `0.4.1` in cacheplane source; it just needs publishing. Verify the source is release-ready (`test` + `build` green), `npm publish --dry-run` to confirm the tarball's `dist` contains the math handler + `math-inline`/`math-display` types, then push the `partial-markdown-v0.4.1` tag — the `publish.yml` workflow publishes via npm OIDC trusted publishing. Confirm `npm view @cacheplane/partial-markdown@0.4.1` and that the published tarball contains math. **Irreversible publish** — dry-run and confirm before the tag push.

### A.1 — Bump the chat dep (no separate "enable" step needed)
Bump `@cacheplane/partial-markdown` from `^0.3.0` → `^0.4.1` in both `libs/chat/package.json` and the root `package.json`, and update the lockfile **surgically** (do not regenerate on macOS — it drops Linux `@next/swc-*` bindings and breaks CI). In `0.4.x` the `dollar`/`bracket` math options **default to `true`**, and currency is guarded (a digit immediately after `$` is rejected, so `$5` is not math), so the existing `createPartialMarkdownParser()` call needs **no options change** — the dep bump alone makes `$x$`/`$$…$$`/`\(…\)`/`\[…\]` tokenize into `math-inline`/`math-display` nodes. (Verify the default empirically against the published build during implementation.)

### A.2 — `MarkdownMathComponent`
A single standalone view component handling both inline and display math via a `display: boolean` input (driven by node type `math-inline` vs `math-display`). Registered in the markdown view registry for both node types. Reads the node's LaTeX `text` and `delimiter`.

### A.3 — Lazy KaTeX
The component **dynamically imports `katex`** (mirroring the existing lazy `marked` load in `markdown-render.ts`), then `katex.renderToString(latex, { displayMode, throwOnError: false })` → sanitize → render. `katex` is declared as a **peer dependency** flagged optional (mirroring how `marked` is a lazy-loaded peer), loaded only when a message contains math, so there is **zero base-bundle cost** for non-math chats. KaTeX's stylesheet is lazy-injected once on first math render.

**CSS/font delivery (under-specified — implementer default, flag for review):** KaTeX's rendered HTML needs `katex.min.css` (which references woff2 fonts) to look right. Default approach: lazy-inject a single pinned `<link rel="stylesheet">` to `katex.min.css` from the jsDelivr CDN with an SRI `integrity` hash + `crossorigin`, once, on first math render. Tradeoff: a runtime third-party fetch (acceptable given the lazy/optional posture, but note the repo's supply-chain-hardening stance). Alternative if a CDN is unwanted: ship the CSS as an inlined style constant in the lib and document that consumers self-host the fonts. Pick during implementation; this is the one design sub-decision the spec leaves open.

**Graceful degradation:** if KaTeX fails to load or the LaTeX is invalid, render the raw `$…$` source text (current behavior) — never crash, never blank.

### A.4 — Testing
- Component test: inline + display math render to KaTeX output (assert a `.katex` element / MathML).
- Streaming test: feeding `$x$` through `chat-streaming-md` yields a `math-inline` node and renders math (not raw `$`).
- Fallback test: invalid LaTeX (e.g. `$\frac{$`) renders the raw source, no throw.
- Live smoke: re-run the math prompt in examples/ag-ui; confirm rendered math in both the reasoning block and the answer.

## Part B — `partial-markdown` hardening (`~/repos/cacheplane`)

Independent library resilience pass; ships as a later partial-markdown release on top of the math `0.4.x`. The chat lib may bump to consume it later, but **A does not depend on B** (A only needs the math `0.4.x` release, A.0).

### B.1 — Backslash-escape handling
Backslash-escaped markdown punctuation — `\_`, `\*`, `\#`, `\$`, `` \` ``, `\[`, `\]`, `\(`, `\)` — renders the **literal character** (backslash dropped) and does **not** trigger its construct. Unit test per escape, including escapes adjacent to real constructs.

### B.2 — Optimistic rendering of unterminated inline constructs
A half-streamed inline construct (`**bold`, `_em`, `` `code ``, `[link`) renders as its **formatted in-progress node** carrying an `unterminated` status — instead of leaking the raw marker as text — so the stream reads smoothly mid-flight and the renderer can optionally style "not yet closed." This is done **in the AST/parser** (extending the existing `unterminated_*` status the math handler already uses), not via a string pre-pass.
**First step:** characterize current behavior per inline construct (which ones already render optimistically vs leak raw); patch only the leaking ones. Tests asserting the in-progress node + status for each.

### B.3 — Chunk-boundary fuzz / property suite
- **Property test:** for a corpus of representative markdown docs, feeding the input in *arbitrary* chunk splits (including a delimiter split across a chunk boundary, e.g. `**` arriving as `*` then `*`) materializes **identically** to a single `push`.
- **Fuzz pass:** random + adversarial inputs (unbalanced delimiters, deep nesting, huge runs) assert **no crash**, no infinite loop, and bounded (non-quadratic) time.

## Boundaries & sequencing

- **A.0 (cacheplane release of the already-built math `0.4.1`) is the one prerequisite for A.** It publishes existing committed code — it is *not* Part B.
- **A.0 → A (chat) is one logical change across two repos**, but two PRs: the cacheplane release (tag push) lands first; then the chat-side PR bumps the dep and adds the math view + lazy KaTeX **together** (bumping without the view would blank out math).
- **B is separate and later.** B (cacheplane) is pure library hardening on top of `0.4.x`; the chat lib need not bump again for B.
- B's detailed task plan is authored in the cacheplane repo when B is implemented; this doc is the shared design of record.

## Error handling (summary)
- **A:** KaTeX load/parse failure → raw-LaTeX-text fallback.
- **B:** parser never crashes, never loops, never leaks raw markers on unterminated/adversarial input.

## Testing (summary)
- **A:** chat component + streaming + fallback tests; live smoke in examples/ag-ui.
- **B:** per-escape unit tests; per-inline-construct unterminated tests; chunk-boundary property test + fuzz pass.

## Scope guardrails (YAGNI)
- No new markdown *features* in A beyond math rendering (B covers GFM gaps separately if ever pursued — explicitly out of scope here).
- One `MarkdownMathComponent`, not two.
- KaTeX stays lazy/optional; no base-bundle weight.
- B is the "targeted + resilience proof" tier: escapes, unterminated-inline, chunk-boundary fuzz — not a full GFM gap-fill.
