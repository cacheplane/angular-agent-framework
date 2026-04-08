# Vercel Deployment — Decisions and Non-Obvious Configuration

**Date:** 2026-03-19
**Status:** Resolved / In production

This document records the non-obvious discoveries made while debugging the Vercel production deployment. Future agents and developers should read this before touching `vercel.json`, PostCSS config, or CI secrets.

---

## 1. Correct `vercel.json` Configuration

**File:** `vercel.json` (repo root)

```json
{
  "buildCommand": "npx nx build website",
  "outputDirectory": "dist/apps/website/.next",
  "framework": "nextjs",
  "installCommand": "npm ci"
}
```

### Why `outputDirectory` is `dist/apps/website/.next`

Vercel's Next.js adapter expects `outputDirectory` to contain `routes-manifest.json` **directly** (not in a subdirectory). The Nx `@nx/next:build` executor outputs to `dist/apps/website/` — placing `.next/` inside that. Vercel must be pointed at the `.next` folder itself.

**Iteration history (do not regress):**

| Value | Result |
|---|---|
| `apps/website` | Error: `routes-manifest.json` not found at `apps/website/routes-manifest.json` |
| `apps/website/.next` | Error: directory not found (Nx outputs to `dist/`, not `apps/`) |
| `dist/apps/website` | Error: `routes-manifest.json` not found at `dist/apps/website/routes-manifest.json` |
| `dist/apps/website/.next` | ✅ Correct |

---

## 2. Tailwind CSS v4 + Next.js 16 Turbopack: PostCSS Config Must Be `.mjs`

**File:** `apps/website/postcss.config.mjs`

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

### Problem

Next.js 16 with Turbopack **silently ignores** TypeScript PostCSS configs (`postcss.config.ts`). The file loaded without error, but PostCSS never ran. In production, the compiled CSS:
- Was only ~16KB (should be ~28KB+ with utilities)
- Contained literal strings like `@source "../"`, `@plugin "..."`, `@theme { ... }` — verbatim, not processed
- Was missing all Tailwind utilities (`.flex`, `.grid`, `.text-sm`, etc.)

### Fix

Rename `postcss.config.ts` → `postcss.config.mjs`. Turbopack supports `.js` and `.mjs` PostCSS configs only.

**Diagnosis signal:** If the compiled CSS file contains literal `@source`, `@plugin`, or `@theme` directives, PostCSS is not running.

### Secondary issue surfaced by the fix

Once PostCSS started running, `@plugin "@tailwindcss/typography"` in `global.css` caused a build failure because `@tailwindcss/typography` was not installed. Removed the `@plugin` directive since the package was not a dependency.

---

## 3. Vercel Org Migration

The project was originally on a personal Vercel account, then moved to the `cacheplane` Vercel team.

### After migration

- **Project ID:** `prj_zIHkOaECRYxOh7GghhWRv79M1gD6` (unchanged)
- **Org ID:** `team_RWMT2bzjj1nkSXI3N3arQ6CP` (new — old was `team_DjeixPtTYBQG210UovUdTJW8`)

### GitHub Secrets required

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | Mint from the `cacheplane` org in Vercel dashboard |
| `VERCEL_ORG_ID` | `team_RWMT2bzjj1nkSXI3N3arQ6CP` |
| `VERCEL_PROJECT_ID` | `prj_zIHkOaECRYxOh7GghhWRv79M1gD6` |

Tokens are scoped to an org — a token minted in one org does not work for another. After an org migration, always mint a new token from the new org.

---

## 4. Package Lock File After Package Rename

When `package.json` `name` fields change in npm workspaces, `package-lock.json` must be regenerated locally and committed. Otherwise `npm ci` in CI will fail with `EUSAGE` because the package names in the lock file don't match.

```bash
npm install --legacy-peer-deps
git add package-lock.json
git commit -m "chore: update package-lock.json after workspace package rename"
```

---

## 5. Pending: `NEXT_PUBLIC_LANGGRAPH_URL` in Vercel

The live demo on the website (`<stream-chat-demo>` Angular Elements component) uses:

```ts
api-url={process.env['NEXT_PUBLIC_LANGGRAPH_URL'] ?? 'http://localhost:2024'}
```

In production, `NEXT_PUBLIC_LANGGRAPH_URL` must be set to the LangGraph Cloud deployment URL. This requires:
1. LangGraph Cloud deployment completed (see `2026-03-19-langsmith-deployment.md`)
2. Environment variable added in Vercel Dashboard → Project → Settings → Environment Variables

---

## 6. Domain

**Production URL:** https://cacheplane.ai
**Vercel project:** https://vercel.com/cacheplane/stream-resource
