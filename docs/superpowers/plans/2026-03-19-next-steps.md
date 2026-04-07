# Next Steps — Session Backlog

**Date:** 2026-03-19
**Thread context:** Package rename, Vercel deployment, licensing migration, SPDX headers

---

## Status snapshot

| Area | Status |
|---|---|
| Package rename → `@cacheplane/*` | ✅ Done |
| Vercel CI deployment | ✅ Done |
| Tailwind CSS production styling | ✅ Done |
| Licensing → PolyForm Noncommercial 1.0.0 | ✅ Done |
| SPDX headers on source files | ✅ Done |
| Session docs committed | ✅ Done |
| npm publish | ⏳ Blocked — needs npm org + token |
| LangSmith deployment | ⏳ Blocked — needs LangGraph Cloud access |
| `NEXT_PUBLIC_LANGGRAPH_URL` in Vercel | ⏳ Blocked — depends on LangSmith |

---

## Item 1 — npm Publish

**Blocked on:** `@cacheplane` npm org + `NPM_TOKEN` GitHub secret

### What Brian needs to do first
1. Create the `@cacheplane` org at https://www.npmjs.com/org/create
2. Mint an automation token at npmjs.com → Account Settings → Access Tokens
3. Add token to GitHub repo as secret `NPM_TOKEN`

### What we implement together
- Add `"files": ["dist", "README.md", "LICENSE", "NOTICE"]` to `packages/mcp/package.json`
- Verify `libs/angular` build output includes the right files
- Dry-run publish both packages
- Publish `@cacheplane/angular` and `@cacheplane/angular-mcp`
- Add a CI `publish` job triggered on `v*.*.*` tags

**Reference:** `docs/superpowers/plans/2026-03-19-npm-publish.md`

---

## Item 2 — LangSmith / LangGraph Cloud Deployment

**Blocked on:** LangGraph Cloud access (LangSmith Plus or Enterprise plan)

### What Brian needs to do first
1. Upgrade LangSmith account to a plan that includes LangGraph Cloud
2. Confirm at smith.langsmith.com → your org → Deployments
3. Provide `LANGSMITH_API_KEY` (or confirm it's in `examples/chat-agent/.env`)
4. Decide which `OPENAI_API_KEY` to use for the production deployment

### What we implement together
- Run `langgraph deploy` from `examples/chat-agent/`
- Note the deployed URL and confirm `chat_agent` assistant ID
- Set runtime env vars in LangSmith dashboard (`OPENAI_API_KEY`, etc.)

**Reference:** `docs/superpowers/plans/2026-03-19-langsmith-deployment.md`

---

## Item 3 — `NEXT_PUBLIC_LANGGRAPH_URL` in Vercel

**Blocked on:** Item 2 (need the deployed LangGraph Cloud URL first)

### Steps (after LangSmith deployment)
1. Vercel Dashboard → cacheplane / angular → Settings → Environment Variables
2. Add `NEXT_PUBLIC_LANGGRAPH_URL` = `https://<your-langgraph-cloud-url>`
3. Set for: Production + Preview + Development
4. Trigger a redeploy
5. Verify live demo at https://cacheplane.ai streams real responses

---

## Order of operations

```
Brian: create npm org + token
  └─> We: npm publish both packages

Brian: upgrade LangSmith plan
  └─> We: langgraph deploy
        └─> We: set NEXT_PUBLIC_LANGGRAPH_URL in Vercel
              └─> Live demo works in production
```

Items 1 and 2 are independent and can be done in parallel.
