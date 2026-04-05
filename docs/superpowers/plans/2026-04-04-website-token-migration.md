# Website Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the website from its local `lib/design-tokens.ts` to the shared `@cacheplane/design-tokens` library, validating the shared lib in production.

**Architecture:** Replace all 32 relative imports (`from '../../../lib/design-tokens'`) with `import { tokens } from '@cacheplane/design-tokens'`. Delete the local `lib/design-tokens.ts`. Verify the website builds and renders correctly.

**Tech Stack:** TypeScript, Next.js, `@cacheplane/design-tokens`

---

### Task 1: Replace all imports and delete local tokens file

**Files:**
- Modify: 32 files in `apps/website/src/` (import path change)
- Delete: `apps/website/lib/design-tokens.ts`

- [ ] **Step 1: Replace all relative imports with the shared lib import**

Run this sed command to replace all import paths across the 32 files:

```bash
find apps/website/src -name '*.tsx' -o -name '*.ts' | xargs grep -l "from.*lib/design-tokens" | xargs sed -i '' "s|from '[^']*lib/design-tokens'|from '@cacheplane/design-tokens'|g"
```

Verify no relative imports remain:
```bash
grep -r "lib/design-tokens" apps/website/src/
```
Expected: No output.

- [ ] **Step 2: Delete the local design-tokens file**

```bash
rm apps/website/lib/design-tokens.ts
```

Check if the `lib/` directory has other files:
```bash
ls apps/website/lib/
```
If only `design-tokens.ts` existed and is now deleted, remove the empty directory. If other files remain, leave the directory.

- [ ] **Step 3: Build the website to verify**

```bash
npx nx build website
```
Expected: Build succeeds with no errors. The `@cacheplane/design-tokens` path alias resolves via `tsconfig.base.json`.

- [ ] **Step 4: Run website tests if any exist**

```bash
npx nx test website --skip-nx-cache 2>/dev/null || echo "No test target"
```

- [ ] **Step 5: Commit**

```bash
git add -A apps/website/
git commit -m "refactor(website): migrate to @cacheplane/design-tokens shared library"
```

---

### Task 2: Visual verification

- [ ] **Step 1: Start the website dev server**

```bash
npx nx serve website
```

- [ ] **Step 2: Verify the landing page renders correctly**

Open `http://localhost:3000`. Check:
- Glass navigation bar with blur effect
- Hero section with gradient background and ambient blobs
- Feature cards with glass treatment
- Stats strip with accent colors
- Footer with glass background
- All text colors correct (dark ink on light bg)

- [ ] **Step 3: Verify the docs pages**

Navigate to `/docs`. Check:
- Sidebar with glass treatment
- Content renders with correct typography
- Code blocks with dark theme
- Callout boxes with colored borders

- [ ] **Step 4: Push**

```bash
git push
```
