# Package Rename Decision Record

**Date:** 2026-03-19
**Status:** Complete

---

## Decision

Rename both published packages to the `@cacheplane` npm scope.

| Before | After |
|---|---|
| `angular` | `@cacheplane/langgraph` |
| `@angular/mcp` | `@cacheplane/langgraph-mcp` |

The website brand name **angular** (used in the hero SVG wordmark, site title, and domain) is unchanged.

---

## Affected Files

### Package manifests

| File | Change |
|---|---|
| `libs/angular/package.json` | `"name": "@cacheplane/langgraph"` |
| `packages/mcp/package.json` | `"name": "@cacheplane/langgraph-mcp"`, `"bin": { "@cacheplane/langgraph-mcp": "dist/index.js" }` |

### TypeScript path aliases

**`tsconfig.base.json`:**
```json
"paths": {
  "@cacheplane/langgraph": ["libs/angular/src/public-api.ts"]
}
```

### Import statements updated across codebase

- `apps/demo/src/app/chat-demo/chat-demo.component.ts`
- `packages/mcp/src/tools/get-example.ts` (all template string import examples)
- `packages/mcp/src/tools/add-angular.ts` (install command + generated diff)
- `packages/mcp/src/tools/scaffold-chat-component.ts` (generated code)
- `apps/website/src/components/shared/InstallStrip.tsx`
- `apps/website/src/components/pricing/PricingGrid.tsx` (npm URL)
- `apps/website/src/components/landing/HeroTwoCol.tsx`
- `apps/website/src/app/llms.txt/route.ts`
- `apps/website/src/app/llms-full.txt/route.ts`
- `README.md` (badge URL, install command, import example)
- `apps/website/content/prompts/getting-started.md`
- `apps/website/content/prompts/testing.md`
- `apps/website/content/prompts/configuration.md`

### MCP binary name

The `npx` command changed from `npx @angular/mcp` to `npx @cacheplane/langgraph-mcp`.

---

## Lock File

After renaming packages in workspace `package.json` files, `npm install --legacy-peer-deps` must be run locally and the updated `package-lock.json` committed. Otherwise `npm ci` in CI fails with `EUSAGE` because the package registry entries in the lock file don't match the new names.

---

## npm Org

The `@cacheplane` scope must exist on npm for `npm publish` to succeed. See `2026-03-19-npm-publish.md`.
