# npm Publish Plan — @cacheplane/angular + @cacheplane/angular-mcp

**Date:** 2026-03-19
**Status:** Not started
**Blocking:** npm org setup, NPM_TOKEN secret

---

## Overview

Publish two packages to npm under the `@cacheplane` scope:

| Package | Version | Registry path |
|---|---|---|
| `@cacheplane/angular` | `0.0.1` | `libs/angular/` |
| `@cacheplane/angular-mcp` | `0.1.0` | `packages/mcp/` |

---

## Prerequisites

### 1. npm org

The `@cacheplane` scope must exist on npm. Create it at https://www.npmjs.com/org/create.

- Org name: `cacheplane`
- This creates the `@cacheplane` scope
- The account publishing must be a member of the org with publish rights

### 2. npm access token

Create a **granular access token** (preferred) or **automation token** from https://www.npmjs.com → Account Settings → Access Tokens.

- Type: Automation (for CI)
- Scope: Read/write access to `@cacheplane/*` packages

### 3. GitHub Secret

Add the token to GitHub repo secrets as `NPM_TOKEN`.

---

## What to Publish

### `@cacheplane/angular`

- Source: `libs/angular/`
- Built by: `npx nx build angular` → outputs to `dist/libs/angular/`
- Publish from: `dist/libs/angular/` (Nx ng-packagr output)
- Entry point: `dist/libs/angular/index.d.ts` and `dist/libs/angular/fesm2022/*.mjs`

The `libs/angular/package.json` must have a `files` field or `ng-package.json` controls what gets included. Verify the dist output contains: `package.json`, `index.d.ts`, `fesm2022/`, `esm2022/`.

### `@cacheplane/angular-mcp`

- Source: `packages/mcp/`
- Build command: `npm run build` (runs `tsc -p tsconfig.json` → outputs to `packages/mcp/dist/`)
- Publish from: `packages/mcp/` (uses `main: "dist/index.js"`)
- The `packages/mcp/package.json` must include a `files` field: `["dist"]`

---

## Steps

### Step 1: Add `files` field to MCP package.json

```json
"files": ["dist", "README.md", "LICENSE", "NOTICE"]
```

### Step 2: Build both packages

```bash
npx nx build angular
cd packages/mcp && npm run build && cd ../..
```

### Step 3: Dry-run publish

```bash
# From dist/libs/angular/
cd dist/libs/angular
npm publish --dry-run --access public

# From packages/mcp/
cd packages/mcp
npm publish --dry-run --access public
```

Verify dry-run output shows only the intended files.

### Step 4: Publish

```bash
# Library
cd dist/libs/angular
npm publish --access public

# MCP
cd packages/mcp
npm publish --access public
```

---

## CI Integration

Add a `publish` job to `.github/workflows/ci.yml` triggered on version tag push (`v*.*.*`):

```yaml
publish:
  needs: [build]
  runs-on: ubuntu-latest
  if: startsWith(github.ref, 'refs/tags/v')
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        registry-url: 'https://registry.npmjs.org'
    - run: npm ci
    - run: npx nx build angular
    - run: cd packages/mcp && npm run build
    - run: cd dist/libs/angular && npm publish --access public
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    - run: cd packages/mcp && npm publish --access public
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Post-Publish

- Verify packages appear at:
  - https://www.npmjs.com/package/@cacheplane/angular
  - https://www.npmjs.com/package/@cacheplane/angular-mcp
- Update npm badge in README.md (badge already points to `@cacheplane/angular`, will populate once published)
- Update `PricingGrid.tsx` `ctaHref` if needed (currently points to npm URL, which is already correct)

---

## Notes

- Both packages are licensed `PolyForm-Noncommercial-1.0.0` — npm will display this correctly since the SPDX identifier is registered
- `--access public` is required for scoped packages on npm's free plan
- Version bumping is manual for now; use `npm version patch/minor/major` in each package dir before publishing
