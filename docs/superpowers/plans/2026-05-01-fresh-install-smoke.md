# Fresh-Install Smoke Test Plan

> Manual validation. Not auto-executable; not part of CI. Output: a working demo app at `~/tmp/ngaf/smoke-app/` proving `@ngaf/*@0.0.1` packages install + build + run from npm.

**Goal:** Prove the published `@ngaf/chat`, `@ngaf/ag-ui`, and `@ngaf/langgraph` packages work in a fresh Angular 20+ project outside this monorepo. Catches packaging bugs (missing files, broken peerDeps, bad exports) that internal tsconfig-paths resolution hides.

**Working directory:** `~/tmp/ngaf/`

**Strategy:** Two thin Angular apps share one workspace.
- **`ag-ui-fake`** — uses `@ngaf/ag-ui`'s `FakeAgent` for end-to-end runtime testing (no backend required).
- **`langgraph-build`** — uses `@ngaf/langgraph`'s `agent()` factory; build-only smoke (no live backend).

End-to-end validation: type a message in the AG-UI app, see streaming canned reply.

---

## Pre-flight

- [ ] **Step 1: Confirm Node version**

```bash
node --version  # expect >= 22.0.0
```

- [ ] **Step 2: Confirm npm cache is clean** (avoid stale package resolution)

```bash
npm cache clean --force 2>&1 | tail -1
```

- [ ] **Step 3: Verify all 7 packages resolve from npm**

```bash
for pkg in chat langgraph ag-ui render a2ui partial-json licensing; do
  echo -n "@ngaf/$pkg: "
  npm view @ngaf/$pkg version 2>/dev/null || echo "NOT FOUND"
done
```

Expected: all 7 print `0.0.1`. If any returns NOT FOUND, the publish was incomplete; fix before proceeding.

---

## Task 1: Create Angular workspace

- [ ] **Step 1: Create the workspace under `~/tmp/ngaf`**

```bash
cd ~/tmp/ngaf
rm -rf smoke-workspace 2>/dev/null
npx -p @angular/cli@latest ng new smoke-workspace \
  --create-application=false \
  --package-manager=npm \
  --skip-git \
  --skip-install
cd smoke-workspace
```

Defaults: routing optional, CSS, no SSR (we're testing the SDK, not Angular SSR).

- [ ] **Step 2: Pin Angular to a specific stable version**

Verify:
```bash
cat package.json | jq '.dependencies."@angular/core"'
```

Should be Angular 20 or 21 (whatever the CLI default produces). Ensure it matches one of the peer-dep ranges in `@ngaf/chat`'s `package.json` (`^20.0.0 || ^21.0.0`).

- [ ] **Step 3: Install workspace deps**

```bash
npm install
```

If npm flags missing peer-deps as warnings, that's fine — we'll install our targets next.

---

## Task 2: AG-UI + FakeAgent app

- [ ] **Step 1: Generate the app**

```bash
cd ~/tmp/ngaf/smoke-workspace
npx ng generate application ag-ui-fake \
  --routing=false \
  --style=css \
  --standalone \
  --skip-tests
```

- [ ] **Step 2: Install `@ngaf/chat` + `@ngaf/ag-ui`**

```bash
npm install @ngaf/chat @ngaf/ag-ui
```

Expected: clean install, no errors. Watch for warnings about unmet peerDeps — those reveal packaging gaps.

- [ ] **Step 3: Wire the app config**

`projects/ag-ui-fake/src/app/app.config.ts`:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideFakeAgUiAgent } from '@ngaf/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFakeAgUiAgent({
      tokens: ['Hi! ', 'I\'m ', 'a ', 'fake ', 'agent ', 'streaming ', 'tokens.'],
      delayMs: 60,
    }),
  ],
};
```

- [ ] **Step 4: Wire the root component**

`projects/ag-ui-fake/src/app/app.component.ts`:

```ts
import { Component, inject } from '@angular/core';
import { ChatComponent } from '@ngaf/chat';
import { AG_UI_AGENT } from '@ngaf/ag-ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div style="height: 100vh; max-width: 720px; margin: 0 auto;">
      <chat [agent]="agent" />
    </div>
  `,
})
export class AppComponent {
  protected readonly agent = inject(AG_UI_AGENT);
}
```

- [ ] **Step 5: Build**

```bash
npx ng build ag-ui-fake
```

Expected: PASS with no errors. Check bundle size — should be reasonable (< 1MB initial JS gzipped). Watch for:
- "Cannot find module '@ngaf/...'" → packaging bug.
- Type-check failures → public-api missing exports.
- ng-packagr-related warnings about dist consumption.

- [ ] **Step 6: Run dev server**

```bash
npx ng serve ag-ui-fake --port 4300
```

Open http://localhost:4300 in a browser. Type a message into the chat input. Expected: streaming canned reply appears token-by-token.

If reply doesn't stream: likely DI wiring; check console for errors.
If page doesn't render: likely CSS/Tailwind dependency missing (chat assumes Tailwind tokens; verify `chat-theme.css` is loaded somehow).

⚠️ **Known concern:** `@ngaf/chat` uses Tailwind utility classes for its components. The smoke app may need a tailwind config + base styles for the rendered components to look right. The build/run will succeed without it; just visuals will be unstyled. That's acceptable for a smoke test focused on packaging.

---

## Task 3: LangGraph build-only smoke

- [ ] **Step 1: Generate the app**

```bash
cd ~/tmp/ngaf/smoke-workspace
npx ng generate application langgraph-build \
  --routing=false \
  --style=css \
  --standalone \
  --skip-tests
```

- [ ] **Step 2: Install `@ngaf/langgraph`** (chat already installed in Task 2)

```bash
npm install @ngaf/langgraph
```

- [ ] **Step 3: Wire the app config**

`projects/langgraph-build/src/app/app.config.ts`:

```ts
import { ApplicationConfig } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [],
};
```

- [ ] **Step 4: Wire the root component**

`projects/langgraph-build/src/app/app.component.ts`:

```ts
import { Component } from '@angular/core';
import { ChatComponent } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatComponent],
  template: `
    <div style="height: 100vh; max-width: 720px; margin: 0 auto;">
      <chat [agent]="lgAgent" />
    </div>
  `,
})
export class AppComponent {
  // No live backend. agent() factory must compile + type-check.
  // We don't actually run a stream; just verify the integration shape.
  protected readonly lgAgent = agent({
    apiUrl: 'http://localhost:2024',
    assistantId: 'chat_agent',
  });
}
```

- [ ] **Step 5: Build**

```bash
npx ng build langgraph-build
```

Expected: PASS. We're not running it — this just confirms packaging + types compile against a real published artifact.

If the build fails: probably `@ngaf/langgraph`'s peerDeps weren't installed (e.g., `@langchain/core`, `@langchain/langgraph-sdk`). npm 7+ doesn't auto-install peerDeps; the build error will name what's missing. Install and retry.

---

## Task 4: Bundle audit

- [ ] **Step 1: Inspect produced bundles**

```bash
cd ~/tmp/ngaf/smoke-workspace
ls -lh dist/ag-ui-fake/browser/*.js | head
ls -lh dist/langgraph-build/browser/*.js | head
```

Note any bundle that's surprisingly large (initial JS > 1MB suggests a tree-shaking gap).

- [ ] **Step 2: Verify no `apps/minting-service` content shipped**

```bash
grep -r "minting-service" dist/ 2>&1 | head -5
```

Expected: zero hits. Catches accidental leakage of proprietary code into the user-facing bundle.

- [ ] **Step 3: Verify license coverage**

Look at `dist/*/browser/3rdpartylicenses.txt` (Angular CLI auto-generates this). Should list `@ngaf/*` packages with MIT license.

```bash
grep -A 1 "@ngaf/" dist/ag-ui-fake/browser/3rdpartylicenses.txt | head -20
```

---

## Task 5: Capture findings

Record any issues discovered into a finding-list. Each finding is one of:
- **Packaging bug** (lib doesn't install/build clean) → file an issue, fix in a PR.
- **Documentation gap** (e.g., the smoke needs Tailwind config; should be in `installation.mdx`) → docs PR.
- **API ergonomics paper cut** (e.g., FakeAgent token list awkwardly long) → consider for next release.

Document in:
- `~/tmp/ngaf/smoke-findings.md` — local notes.
- A GitHub issue for each Severity-1+ finding (packaging or runtime bug).

---

## Out of Scope

- LangGraph live backend testing — no backend running locally.
- AG-UI live backend testing — no public AG-UI-native HTTP endpoint available.
- E2E test automation — this is a one-time smoke pass, not a regression suite.
- Tailwind / theming setup — visuals may render unstyled; not the point.
- React / non-Angular consumer paths — out of scope for `@ngaf/*` (Angular-only).
- Verifying SSR / SSG compatibility — not in scope.

## Cleanup

After smoke pass completes:

```bash
# Optionally keep ~/tmp/ngaf/smoke-workspace for re-runs
# Or remove:
rm -rf ~/tmp/ngaf/smoke-workspace
```
