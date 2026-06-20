# Chat Math Rendering (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop LaTeX/math leaking as raw `$…$` text in the chat stream by releasing the already-built `@cacheplane/partial-markdown` math handler, bumping the chat dep, and rendering `math-inline`/`math-display` nodes through a lazy-KaTeX view component.

**Architecture:** The published partial-markdown (`0.3.2`) has **no** math support; it lives unreleased in cacheplane source at `0.4.1`. So this is one logical change across two repos: **(A.0)** tag-publish partial-markdown `0.4.1` (existing committed code) → **(A.1–A.4)** in `@threadplane/chat`, bump the dep and add a `MarkdownMathComponent` that lazy-loads KaTeX, registered for both math node types. The dep bump and the view component **must ship in the same chat PR** — `md-children` renders *nothing* for an unregistered node type, so bumping alone would turn the raw-`$` leak into blank math.

**Tech Stack:** Angular 20 standalone signals components, `@cacheplane/partial-markdown` AST, KaTeX (lazy `import('katex')`, peer dep mirroring `marked`), Nx, Vitest, Playwright (live smoke via examples/ag-ui).

**Spec:** `docs/superpowers/specs/2026-06-20-resilient-markdown-math-rendering-design.md` (Part A; corrected 2026-06-20 to add A.0). Part B (parser hardening) is out of scope here.

**Resolved sub-decision:** KaTeX CSS/font delivery is **self-hosted** (human chose, 2026-06-20) — NO runtime CDN. The lib does not inject any stylesheet; consumers import `katex/dist/katex.min.css` themselves, and the example apps add it to their `styles`. See Task 4, Step 4.

**Branch:** `feat/chat-math-rendering` (already checked out; spec already on it).

---

## File Structure

**cacheplane repo (`~/repos/cacheplane`) — A.0, no source edits:**
- Release-only: verify + `npm publish --dry-run` + push tag `partial-markdown-v0.4.1`.

**this repo (`angular-agent-framework`) — A.1–A.4:**
- Modify: `package.json`, `libs/chat/package.json` — bump `@cacheplane/partial-markdown` to `^0.4.1`; add `katex` peer (+ optional meta).
- Modify: `package-lock.json` — surgical (do NOT regenerate on macOS).
- Create: `libs/chat/src/lib/markdown/katex-loader.ts` — lazy KaTeX load + `renderMath()` + lazy CSS inject + `katexReady` signal.
- Create: `libs/chat/src/lib/markdown/katex-loader.spec.ts`.
- Create: `libs/chat/src/lib/markdown/views/markdown-math.component.ts` — single view for `math-inline` + `math-display`.
- Create: `libs/chat/src/lib/markdown/views/markdown-math.component.spec.ts`.
- Modify: `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts` — register `math-inline` + `math-display`.
- Modify: `libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts` — assert both keys resolve.
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts` — `$x$` → math-inline → KaTeX.
- Modify: `libs/chat/src/public-api.ts` — export `MarkdownMathComponent` (parity with the other 22 view components).
- Modify (optional, math styles): `libs/chat/src/lib/styles/chat-markdown.styles.ts`.

---

## Task 1: A.0 — Release `@cacheplane/partial-markdown` 0.4.1 (cacheplane repo)

Publishes already-committed math code. **Irreversible npm publish** — dry-run and get explicit human go-ahead before the tag push (memory: "dry-run first; npm writes irreversible").

**Files:** none edited. Repo: `~/repos/cacheplane`. Release mechanism: `.github/workflows/publish.yml` triggers on a `partial-markdown-v*` tag and runs `npm publish --access public --provenance` via OIDC. The workflow verifies `package.json.version` matches the tag version (already `0.4.1`).

- [ ] **Step 1: Confirm clean tree on the release commit**

Run:
```bash
cd ~/repos/cacheplane && git fetch -q origin && git log --oneline -1 -- packages/partial-markdown && git status --short packages/partial-markdown/
```
Expected: HEAD includes `391a066 … 0.4.1 hotfix`; `git status` for that path is empty (clean). If `0.4.1` is NOT on the default branch's tip / not pushed, STOP and resolve with the human — do not publish from a local-only commit.

- [ ] **Step 2: Verify the package is release-ready**

Run:
```bash
cd ~/repos/cacheplane && pnpm install --frozen-lockfile && pnpm --filter @cacheplane/partial-markdown test && pnpm --filter @cacheplane/partial-markdown build
```
Expected: tests green, `dist/` built. If red, STOP — do not publish a failing build.

- [ ] **Step 3: Dry-run publish and confirm the tarball contains math**

Run:
```bash
cd ~/repos/cacheplane/packages/partial-markdown
npm publish --dry-run 2>&1 | tail -30
node -e "console.log('version', require('./package.json').version)"
grep -c "math-inline\|dollar" dist/index.d.ts
```
Expected: version `0.4.1`; the `grep` count is `> 0` (math IS in the build); dry-run lists `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts`. If the grep is `0`, STOP — the build lacks math; investigate before publishing.

- [ ] **Step 4: HUMAN GATE — get explicit go-ahead to publish**

Report to the human: version, tarball contents, that math is present. Wait for an explicit "yes, publish" before Step 5. (This is the irreversible action.)

- [ ] **Step 5: Tag and push to trigger OIDC publish**

Run:
```bash
cd ~/repos/cacheplane
git tag partial-markdown-v0.4.1
git push origin partial-markdown-v0.4.1
```
Then watch the workflow:
```bash
gh run watch "$(gh run list --workflow=publish.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```
Expected: `Publish` workflow succeeds.

- [ ] **Step 6: Verify the published package**

Run:
```bash
npm view @cacheplane/partial-markdown version
cd /tmp && rm -rf pm041 && mkdir pm041 && cd pm041 && npm pack @cacheplane/partial-markdown@0.4.1 >/dev/null 2>&1 && tar -xf *.tgz && grep -c "math-inline\|dollar" package/dist/index.d.ts
```
Expected: `0.4.1`; grep count `> 0`. Math is now on npm.

- [ ] **Step 7: Commit (none needed)** — A.0 has no repo edits in `angular-agent-framework`. Proceed to Task 2.

---

## Task 2: A.1 — Bump deps + add KaTeX (this repo)

**Files:**
- Modify: `package.json` (root) — `@cacheplane/partial-markdown` → `^0.4.1`; add `katex` + `@types/katex` devDeps.
- Modify: `libs/chat/package.json` — `@cacheplane/partial-markdown` → `^0.4.1`; add `katex` to `peerDependencies` + `peerDependenciesMeta`.
- Modify: `package-lock.json` — surgically (memory: never regenerate on macOS — it drops Linux `@next/swc-*` bindings and breaks CI).

- [ ] **Step 1: Bump the partial-markdown range in both manifests**

In `package.json` (root) and `libs/chat/package.json`, change:
```json
"@cacheplane/partial-markdown": "^0.3.0"
```
to:
```json
"@cacheplane/partial-markdown": "^0.4.1"
```

- [ ] **Step 2: Declare `katex` as an optional peer in the chat lib**

In `libs/chat/package.json`, add `katex` to `peerDependencies` (alongside `marked`):
```json
"katex": "^0.16.0 || ^0.17.0"
```
and add a `peerDependenciesMeta` block marking it optional (math is opt-in; markdown is core):
```json
"peerDependenciesMeta": {
  "katex": { "optional": true }
}
```

- [ ] **Step 3: Add `katex` + types as root devDeps (for lib tests + nx-served examples)**

In root `package.json` `devDependencies`, add (use the version that resolves; `@types/katex` latest is `0.16.8`):
```json
"katex": "^0.17.0",
"@types/katex": "^0.16.8"
```

- [ ] **Step 4: Update the lockfile surgically + verify no platform bindings dropped**

Run:
```bash
cd /Users/blove/repos/angular-agent-framework
git stash --keep-index 2>/dev/null; npm install --package-lock-only 2>&1 | tail -3
git diff --stat package-lock.json
git diff package-lock.json | grep -iE "swc-linux|swc-darwin|lightningcss|next/swc" || echo "no platform bindings touched"
```
Expected: `package-lock.json` gains `katex`/`@types/katex` and updated `@cacheplane/partial-markdown` `0.4.1`; the grep prints "no platform bindings touched". **If any `@next/swc-linux-*` / lightningcss linux binding was REMOVED, restore those lines** with `git checkout -p package-lock.json` (keep the katex/partial-markdown additions, reject the binding deletions). Re-run the grep until clean.

- [ ] **Step 5: Install and confirm partial-markdown resolves to 0.4.1**

Run:
```bash
npm install 2>&1 | tail -3
node -e "console.log(require('@cacheplane/partial-markdown/package.json').version)"
grep -rc "math-inline" node_modules/@cacheplane/partial-markdown/dist/index.d.ts
```
Expected: `0.4.1`; grep `> 0`.

- [ ] **Step 6: Empirically confirm `$x$` now tokenizes as math (default options)**

Run:
```bash
cd /Users/blove/repos/angular-agent-framework
cat > /tmp/pm-probe.mjs <<'EOF'
import { createPartialMarkdownParser, materialize } from '@cacheplane/partial-markdown';
const p = createPartialMarkdownParser();              // no options — dollar defaults true
p.push('Euler $e^{i\\pi}+1=0$ and $$a^2+b^2$$ but not $5 or $10.');
p.push('\n'); p.finish();
const types = []; (function w(n){ if(!n) return; if(n.type) types.push(n.type); (n.children||[]).forEach(w); })(materialize(p.root));
console.log('types:', [...new Set(types)].join(', '));
console.log('math-inline:', types.includes('math-inline'), 'math-display:', types.includes('math-display'));
EOF
node --input-type=module < /tmp/pm-probe.mjs
```
Expected: `math-inline: true math-display: true`. (Currency `$5`/`$10` must NOT break — the handler rejects a digit right after `$`.) If math is false, STOP — the dep didn't bump or the default isn't `dollar:true`; re-check before proceeding.

- [ ] **Step 7: Commit**

```bash
git add package.json libs/chat/package.json package-lock.json
git commit -m "build(chat): bump partial-markdown to ^0.4.1 (math) + add optional katex peer"
```

---

## Task 3: A.3 (loader) — Lazy KaTeX loader (TDD)

A framework-light module that lazy-imports KaTeX and renders LaTeX → HTML string, with a readiness signal and lazy CSS injection. Mirrors `streaming/markdown-render.ts`'s lazy-`marked` pattern.

**Files:**
- Create: `libs/chat/src/lib/markdown/katex-loader.ts`
- Test: `libs/chat/src/lib/markdown/katex-loader.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `libs/chat/src/lib/markdown/katex-loader.spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeAll } from 'vitest';
import { renderMath, katexLoaded } from './katex-loader';

describe('katex-loader', () => {
  beforeAll(async () => { await katexLoaded; });

  it('renders inline LaTeX to KaTeX HTML', () => {
    const html = renderMath('x^2 + y^2', false);
    expect(html).toBeTypeOf('string');
    expect(html).toContain('katex');
  });

  it('renders display LaTeX with displayMode markup', () => {
    const html = renderMath('\\sum_{i=0}^n i', true);
    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
  });

  it('returns null (raw-fallback signal) for invalid LaTeX, no throw', () => {
    expect(() => renderMath('\\frac{', false)).not.toThrow();
    expect(renderMath('\\frac{', false)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test chat --testPathPattern=katex-loader`
Expected: FAIL — `Cannot find module './katex-loader'`.

- [ ] **Step 3: Write the loader**

Create `libs/chat/src/lib/markdown/katex-loader.ts`:
```ts
// libs/chat/src/lib/markdown/katex-loader.ts
// SPDX-License-Identifier: MIT
import { signal } from '@angular/core';

/**
 * Lazy KaTeX integration for the markdown math view. Mirrors the lazy
 * `marked` loader in ../streaming/markdown-render.ts: `katex` is an optional
 * peer dependency dynamically imported on module load, so non-math chats pay
 * zero base-bundle cost. `renderMath` returns the KaTeX HTML string, or null
 * when KaTeX is unavailable or the LaTeX is invalid (the view then renders the
 * raw `$…$` source).
 */

let katexRender: ((latex: string, displayMode: boolean) => string) | null = null;

/** Flips to true once KaTeX has loaded; views read it to re-render math that fell back to raw while loading. */
export const katexReady = signal(false);

/** Resolves once the KaTeX import has settled (success or failure). Tests await this. */
export const katexLoaded: Promise<void> = import('katex')
  .then((m) => {
    const katex = (m as { default?: unknown }).default ?? m;
    katexRender = (latex, displayMode) =>
      // throwOnError:true so invalid LaTeX throws → we catch → raw-source fallback,
      // instead of KaTeX rendering its own red error markup.
      (katex as { renderToString: (s: string, o: object) => string }).renderToString(latex, {
        displayMode,
        throwOnError: true,
      });
    katexReady.set(true);
  })
  .catch(() => {
    katexRender = null;
  });

// CSS: the KaTeX stylesheet (and its woff2 fonts) is the CONSUMER's
// responsibility — the lib injects nothing at runtime (self-hosted by choice;
// no third-party CDN fetch). Consumers import `katex/dist/katex.min.css`; math
// renders without it (just unstyled), so unit tests don't need it.

/**
 * Render LaTeX to a KaTeX HTML string, or null if KaTeX is unavailable or the
 * input throws (invalid LaTeX) — the caller then renders the raw `$…$` source.
 */
export function renderMath(latex: string, displayMode: boolean): string | null {
  if (!katexRender) return null;
  try {
    return katexRender(latex, displayMode);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test chat --testPathPattern=katex-loader`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add libs/chat/src/lib/markdown/katex-loader.ts libs/chat/src/lib/markdown/katex-loader.spec.ts
git commit -m "feat(chat): lazy KaTeX loader for markdown math rendering"
```

---

## Task 4: A.2 — `MarkdownMathComponent` + registry + CSS (TDD)

**Files:**
- Create: `libs/chat/src/lib/markdown/views/markdown-math.component.ts`
- Test: `libs/chat/src/lib/markdown/views/markdown-math.component.spec.ts`
- Modify: `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts`
- Modify: `libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts`
- Modify: `libs/chat/src/public-api.ts`
- Modify: `libs/chat/src/lib/markdown/katex-loader.ts` (CSS constants)

- [ ] **Step 1: Write the failing component test**

Create `libs/chat/src/lib/markdown/views/markdown-math.component.spec.ts`:
```ts
// SPDX-License-Identifier: MIT
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MarkdownMathComponent } from './markdown-math.component';
import { katexLoaded } from '../katex-loader';
import type { MarkdownMathInlineNode, MarkdownMathDisplayNode } from '@cacheplane/partial-markdown';

const inline = (text: string): MarkdownMathInlineNode =>
  ({ type: 'math-inline', text, delimiter: '$' } as MarkdownMathInlineNode);
const display = (text: string): MarkdownMathDisplayNode =>
  ({ type: 'math-display', text, delimiter: '$$' } as MarkdownMathDisplayNode);

function render(node: MarkdownMathInlineNode | MarkdownMathDisplayNode): HTMLElement {
  const fixture = TestBed.createComponent(MarkdownMathComponent);
  fixture.componentRef.setInput('node', node);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MarkdownMathComponent', () => {
  beforeAll(async () => { await katexLoaded; });

  it('renders inline math as KaTeX', () => {
    const el = render(inline('x^2'));
    expect(el.querySelector('.katex')).toBeTruthy();
    expect(el.textContent).not.toContain('$');
  });

  it('renders display math as KaTeX display', () => {
    const el = render(display('\\sum_{i=0}^n i'));
    expect(el.querySelector('.katex-display')).toBeTruthy();
  });

  it('falls back to raw source (with delimiters) for invalid LaTeX', () => {
    const el = render(inline('\\frac{'));
    expect(el.querySelector('.katex')).toBeFalsy();
    expect(el.textContent).toContain('$\\frac{$');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx nx test chat --testPathPattern=markdown-math.component`
Expected: FAIL — `Cannot find module './markdown-math.component'`.

- [ ] **Step 3: Write the component**

Create `libs/chat/src/lib/markdown/views/markdown-math.component.ts`:
```ts
// libs/chat/src/lib/markdown/views/markdown-math.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  SecurityContext,
  computed,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import type {
  MarkdownMathInlineNode,
  MarkdownMathDisplayNode,
} from '@cacheplane/partial-markdown';
import { renderMath, katexReady } from '../katex-loader';

type MathNode = MarkdownMathInlineNode | MarkdownMathDisplayNode;

/** Opener/closer source text per delimiter, used for the raw fallback. */
const DELIMITERS: Record<MathNode['delimiter'], readonly [string, string]> = {
  $: ['$', '$'],
  '$$': ['$$', '$$'],
  '\\(\\)': ['\\(', '\\)'],
  '\\[\\]': ['\\[', '\\]'],
};

/**
 * Renders a `math-inline` / `math-display` markdown node as KaTeX. KaTeX is
 * lazy-loaded (see katex-loader); until it resolves, or if the LaTeX is
 * invalid, the raw `$…$` source is shown — never blank, never a crash.
 */
@Component({
  selector: 'chat-md-math',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (html(); as h) {
      <span
        class="chat-md-math"
        [class.chat-md-math--display]="display()"
        [innerHTML]="h"
      ></span>
    } @else {
      <span class="chat-md-math chat-md-math--raw">{{ raw() }}</span>
    }
  `,
})
export class MarkdownMathComponent {
  readonly node = input.required<MathNode>();
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly display = computed(() => this.node().type === 'math-display');

  protected readonly raw = computed(() => {
    const n = this.node();
    const [open, close] = DELIMITERS[n.delimiter];
    return `${open}${n.text}${close}`;
  });

  protected readonly html = computed<SafeHtml | null>(() => {
    katexReady(); // re-render once KaTeX finishes loading
    const n = this.node();
    const out = renderMath(n.text, n.type === 'math-display');
    if (out == null) return null;
    // Trust KaTeX output directly: KaTeX with the default `trust:false` emits
    // only safe presentational markup (no scripts/links), and Angular's HTML
    // sanitizer would strip the inline styles KaTeX layout depends on. Keep a
    // SecurityContext.HTML check available for defense, but bypass for KaTeX.
    void SecurityContext.HTML;
    return this.sanitizer.bypassSecurityTrustHtml(out);
  });
}
```

- [ ] **Step 4: KaTeX CSS — self-hosted (documented, no runtime CDN)**

The lib injects no stylesheet (decision: self-host). Do two things:

1. **Document it** in `libs/chat/README.md` — add a short "Math rendering (KaTeX)" note near the markdown section:
   > Math (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`) renders via KaTeX, an optional peer dependency loaded lazily only when a message contains math. To style it, install `katex` and import its stylesheet once in your app: `import 'katex/dist/katex.min.css';` (or add it to your Angular `styles`). Without the stylesheet, math still renders — just unstyled.

2. **Add the CSS to the example apps** so the live smoke (Task 6) looks right. In `examples/ag-ui/angular/project.json` (and `examples/chat/angular/project.json` if it has the same markdown surface), add `"node_modules/katex/dist/katex.min.css"` to the build target's `options.styles` array. Verify the path key:
   ```bash
   grep -rn '"styles"' examples/ag-ui/angular/project.json examples/chat/angular/project.json
   ```
   If an example uses a `styles.css` entrypoint instead of `project.json` `styles[]`, add `@import 'katex/dist/katex.min.css';` there instead. (No KaTeX CSS is needed for unit tests — math renders unstyled, assertions check for `.katex`, not styling.)

- [ ] **Step 5: Add minimal wrapper styles**

In `libs/chat/src/lib/styles/chat-markdown.styles.ts`, append to the existing styles string a block for display-math centering/scroll:
```css
.chat-md-math--display { display: block; margin: 0.5em 0; overflow-x: auto; }
.chat-md-math--raw { font-family: var(--chat-font-mono, ui-monospace, monospace); }
```
(Append inside the existing template-literal export; match its current formatting.)

- [ ] **Step 6: Run the component test to verify it passes**

Run: `npx nx test chat --testPathPattern=markdown-math.component`
Expected: PASS (3/3).

- [ ] **Step 7: Register both node types in the view registry**

In `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts`, add the import:
```ts
import { MarkdownMathComponent } from './views/markdown-math.component';
```
and add two entries to the `views({ … })` map (next to `inline-code`):
```ts
  'math-inline':    MarkdownMathComponent,
  'math-display':   MarkdownMathComponent,
```

- [ ] **Step 8: Assert registry coverage**

In `libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts`, add:
```ts
it('registers a view for both math node types', () => {
  expect(cacheplaneMarkdownViews['math-inline']).toBe(MarkdownMathComponent);
  expect(cacheplaneMarkdownViews['math-display']).toBe(MarkdownMathComponent);
});
```
(Add the `MarkdownMathComponent` import to the spec's imports.)

Run: `npx nx test chat --testPathPattern=cacheplane-markdown-views`
Expected: PASS.

- [ ] **Step 9: Export the component (parity with the other 22 views)**

In `libs/chat/src/public-api.ts`, alongside the other `Markdown*Component` exports, add:
```ts
export { MarkdownMathComponent } from './lib/markdown/views/markdown-math.component';
```

- [ ] **Step 10: Commit**

```bash
git add libs/chat/src/lib/markdown/views/markdown-math.component.ts \
        libs/chat/src/lib/markdown/views/markdown-math.component.spec.ts \
        libs/chat/src/lib/markdown/cacheplane-markdown-views.ts \
        libs/chat/src/lib/markdown/cacheplane-markdown-views.spec.ts \
        libs/chat/src/lib/markdown/katex-loader.ts \
        libs/chat/src/lib/styles/chat-markdown.styles.ts \
        libs/chat/src/public-api.ts
git commit -m "feat(chat): MarkdownMathComponent renders math nodes via lazy KaTeX"
```

---

## Task 5: A.4 — Streaming integration test (TDD)

Proves the end-to-end chat path: `$x$` fed through `<chat-streaming-md>` tokenizes into a `math-inline` node and renders KaTeX (not raw `$`).

**Files:**
- Modify: `libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts`

- [ ] **Step 1: Write the failing test**

In `streaming-markdown.integration.spec.ts`, add (await `katexLoaded` first; import it + `ChatStreamingMdComponent` per the file's existing harness):
```ts
import { katexLoaded } from '../markdown/katex-loader';

it('renders inline math instead of leaking raw $ delimiters', async () => {
  await katexLoaded;
  const fixture = TestBed.createComponent(ChatStreamingMdComponent);
  fixture.componentRef.setInput('content', 'Euler: $e^{i\\pi}+1=0$ done.');
  fixture.componentRef.setInput('streaming', false);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  expect(el.querySelector('.katex')).toBeTruthy();
  expect(el.textContent).toContain('Euler:');
  expect(el.textContent).not.toContain('$e^{i');
});
```
(Match the existing spec's component-creation idiom — reuse its TestBed setup/imports.)

- [ ] **Step 2: Run it to verify it passes** (component + registry already exist from Task 4)

Run: `npx nx test chat --testPathPattern=streaming-markdown.integration`
Expected: PASS. (If it FAILS because the parser didn't tokenize, re-check Task 2 Step 6.)

- [ ] **Step 3: Commit**

```bash
git add libs/chat/src/lib/streaming/streaming-markdown.integration.spec.ts
git commit -m "test(chat): streaming math renders KaTeX, not raw \$ source"
```

---

## Task 6: Gates, live smoke, PR

**Files:** none new — verification + PR.

- [ ] **Step 1: Full chat lib gates**

Run:
```bash
cd /Users/blove/repos/angular-agent-framework
npx nx run-many -t lint,test,build --projects=chat
```
Expected: all green. (`build` proves the lib's tsc resolves `import('katex')` types via `@types/katex` and the new node types from `0.4.1`.)

- [ ] **Step 2: Build a consuming example (proves prod build + katex resolution)**

Run:
```bash
npx nx build examples-ag-ui-angular
```
Expected: green. (memory: example prod builds compile lib source with `strict:false` and catch union-narrowing breaks; build at least one example before claiming green.)

- [ ] **Step 3: DX-coverage guard (new exported component must not trip it)**

Run: `node scripts/check-dx-coverage.mjs`
Expected: ✓ (the guard checks exported *functions*; a component class isn't gated, but confirm no regression).

- [ ] **Step 4: Live smoke in examples/ag-ui**

Start backend + dev server (per the standing runbook; kill stale servers on :4201/:8000 first — memory: orphaned dev servers serve the OLD bundle), then drive Chrome to `localhost:4201/embed` and send a prompt that elicits math, e.g.:
> "Show me the quadratic formula and Euler's identity in LaTeX."

Confirm: rendered math (KaTeX spans) in the answer — **no** raw `$…$` / `\frac` / `\sqrt` text. Screenshot for the PR. Re-confirm a currency case ("$5 and $10") still renders as plain text, not math.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin feat/chat-math-rendering
gh pr create --title "feat(chat): render LaTeX/math via lazy KaTeX" --body "<summary: A.0 release link + the co-ship constraint + live screenshot>"
```
Body must note: depends on `@cacheplane/partial-markdown@0.4.1` (released in Task 1); dep-bump + view co-shipped; KaTeX is an optional lazy peer (zero base-bundle cost); CSS delivery choice (CDN+SRI vs self-host) per the human's Task 4 decision.

- [ ] **Step 6: Enable auto-merge**

```bash
gh pr merge --squash --auto
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** A.0 (Task 1), A.1 dep bump (Task 2), A.2 component+registry (Task 4), A.3 lazy KaTeX+CSS+fallback (Tasks 3–4), A.4 component/streaming/fallback tests + live smoke (Tasks 4–6). ✓
- **Co-ship constraint** (bump + view together) is enforced: Tasks 2 and 4 are in the same PR/branch; the streaming test (Task 5) would fail if either were missing. ✓
- **Type consistency:** `MathNode = MarkdownMathInlineNode | MarkdownMathDisplayNode`; delimiter literals `'$' | '$$' | '\(\)' | '\[\]'` match `partial-markdown` source types; `renderMath(latex, displayMode)` signature consistent across loader + component + tests. ✓
- **`throwOnError`:** intentionally `true` (not the spec's `false`) so invalid LaTeX throws → caught → raw fallback, matching the spec's *behavioral* requirement ("invalid LaTeX renders the raw source"). Noted in code + here. ✓
- **No placeholders:** CSS is self-hosted (no CDN constants to fill); Task 4 Step 4 is documentation + an example `styles[]` entry verified against the actual `project.json` key. ✓
- **Irreversible-action gate:** the npm publish (Task 1) has an explicit human go-ahead step before the tag push. ✓
