# "What `injectAgent()` Actually Returns" Blog Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a conceptual blog post targeting the `injectagent` search query (108 impressions, position 5.6) that answers "what is this for," complementing — not duplicating — the API reference page.

**Architecture:** One new MDX file in `apps/website/content/blog/`. No code changes. The post is a "contract tour" in three groups (signals → methods → the two-type return), written in Brian's 2026 technical register per `docs/gtm/voice.md` with the no-anecdotes override.

**Tech Stack:** MDX blog content, Next.js website (`apps/website`), vitest for content validation.

**Spec:** `docs/superpowers/specs/2026-08-26-blog-sequence-inject-agent-design.md`

---

## Verified API facts (source of truth for every claim in the post)

Verified 2026-08-26 against worktree source. **If drafting from a different checkout, re-verify against `libs/chat/src/lib/agent/agent.ts` and `libs/langgraph/src/lib/agent.types.ts` before writing.**

Main can be ahead of npm (releases fire only on a pushed tag). Before finalizing the draft, confirm every member the post names exists in the published `0.0.58` line: `npm pack @threadplane/langgraph@latest @threadplane/chat@latest` into the scratchpad and grep the `.d.ts` for each named signal/method. If a member is main-only, drop it from the post rather than footnoting it.

**Runtime-neutral `Agent<TState>` contract** (`libs/chat/src/lib/agent/agent.ts:27`):
- Signals: `messages` (`Message[]`), `status` (`AgentStatus`), `isLoading` (`boolean`), `error` (`AgentError | undefined`), `toolCalls` (`ToolCall[]`), `state` (`TState`)
- Methods: `submit(input, opts?)`, `stop()`, `retry()`, `regenerate(assistantMessageIndex)`
- Optional: `interrupt?`, `subagents?`, `clientTools?`
- Events: `events$` (Observable, required)

**`AgentWithHistory<TState>`** (`libs/chat/src/lib/agent/agent-with-history.ts:13`) adds `history` (`AgentCheckpoint[]`) and optional `messageCheckpoints`.

**`LangGraphAgent<T>`** (`libs/langgraph/src/lib/agent.types.ts:331`) extends `AgentWithHistory<T>` and adds (selection for the post — do not enumerate all in prose):
- Raw signals prefixed `langGraph*`: `langGraphMessages`, `langGraphInterrupts`, `langGraphToolCalls`, `langGraphHistory` — the prefix exists to avoid collision with the runtime-neutral names
- LangGraph-specific: `value`, `hasValue`, `toolProgress`, `queue`, `branch`/`setBranch`, `isThreadLoading`, `switchThread`, `joinStream`, `activeSubagents`/`getSubagent`/`getSubagentsByType`/`getSubagentsByMessage`, `customEvents`, `lifecycle`, `experimentalBranchTree`, `reload`
- `clientTools` is **required** here (optional on the neutral contract)
- `submit` widens options with `LangGraphSubmitOptions` (resume commands, checkpoint forks)

**Key facts for the "two types" section:**
- `injectAgent()` (no-arg) returns default-typed `LangGraphAgent`; `injectAgent<T>(ref)` with `createAgentRef<T>()` returns `LangGraphAgent<T>` (per `apps/website/content/docs/langgraph/api/inject-agent.mdx`)
- Everything `<chat>` and the other primitives bind lives on the `Agent`/`AgentWithHistory` slice; the LangGraph-specific members are additive
- The AG-UI adapter's `injectAgent()` returns the same neutral slice — that's the swap-runtimes story; link `/docs/choosing-an-adapter`

---

### Task 1: Author the post

**Files:**
- Create: `apps/website/content/blog/2026-08-26-what-inject-agent-returns.mdx`

Slug derives from the filename minus the date prefix (`apps/website/src/lib/blog.ts:34`) → `/blog/what-inject-agent-returns`.

- [ ] **Step 1: Create the file with this exact frontmatter**

```yaml
---
title: 'What injectAgent() Actually Returns'
description: 'The signals, the async methods, and the runtime-neutral Agent contract underneath — what you get from one call.'
date: 2026-08-26
tags: [langgraph, angular, signals, agentic-ui]
author: brian
featured: false
draft: false
---
```

The description is 110 characters — under the 155-char truncation limit in `apps/website/src/lib/docs.ts`. If you edit it, re-count.

- [ ] **Step 2: Write the lede and body sections**

Structure (from the approved spec) with per-section content requirements:

1. **Lede** (no header): one sentence restating the title — one call, one object; here's what's actually in it. Then 2–3 short lines framing the question: the API page answers "what's the signature"; this post answers "what is this for." Link the API page (`/docs/langgraph/api/inject-agent`) in the lede.
2. **`## What are the signals?`** — answer immediately. Name exactly the six core signals from the verified facts (`messages`, `status`, `isLoading`, `error`, `toolCalls`, `state`) and what each is for in one line each. Point: this is the reactive surface you bind templates to; no subscriptions, no manual change detection.
3. **`## What are the methods?`** — `submit`, `stop`, `retry`, `regenerate`, each in one or two lines including the non-obvious semantics documented in source (retry is a no-op mid-run; regenerate trims and re-runs from the preceding user message). Point: the imperative surface user actions call.
4. **`## Why is the return type two types?`** — the strategic section. `LangGraphAgent<T>` extends the runtime-neutral `Agent` contract. The neutral slice is what `<chat>` consumes; the `langGraph*`-prefixed signals and LangGraph-specific members (`value`, `branch`, `switchThread`, `lifecycle` — name a handful, don't enumerate all) are additive. The AG-UI adapter returns the same neutral slice, which is what makes runtimes swappable. Link `/docs/choosing-an-adapter`. Flag the recommendation as an opinion ("For me, …" or "I think …").
5. **`## What does this look like in a component?`** — one snippet, verbatim:

```ts
import { Component } from '@angular/core';
import { injectAgent } from '@threadplane/langgraph';

@Component({
  selector: 'app-support',
  template: `
    @for (message of chat.messages(); track message.id) {
      <p>{{ message.content }}</p>
    }
    @if (chat.isLoading()) {
      <p>Thinking…</p>
    }
  `,
})
export class SupportComponent {
  readonly chat = injectAgent();

  async send(text: string) {
    await this.chat.submit({ message: text });
  }
}
```

   Before using, verify `message.id` and `message.content` exist on `Message` (`libs/chat/src/lib/agent/message.ts`) and that `submit({ message })` matches `AgentSubmitInput` (`libs/chat/src/lib/agent/agent-submit.ts`); adjust the snippet to the real shapes if they differ. Follow with one line: this is not the full setup — link the quickstart (`/docs/langgraph/getting-started/quickstart`) for `provideAgent()` configuration.
6. **`## Conclusion`** — one paragraph restating the takeaway (one call returns the whole agent surface: reactive signals, imperative methods, and a contract that isn't LangGraph-shaped). Forward links: API page, choosing-an-adapter, and the streaming-chat tutorial (`/blog/build-a-streaming-chat-ui-in-angular-with-langgraph`). Close with a forward link or short invitation — no marketing CTA.

Include the standard Threadplane licensing `<Callout>` (copy the exact block from `apps/website/content/blog/2026-08-13-angular-chat-app-tutorial-with-langchain-langgraph.mdx:27-32`) after the lede, since the post shows `@threadplane/chat`-adjacent usage.

- [ ] **Step 3: Voice pass**

Check the draft against `docs/gtm/voice.md` drafting checklist with the 2026 technical override (`docs/gtm/blog-topic-candidates.md` caveats + memory: no invented first-person anecdotes, no emoji, trimmed rhetoric):

- Opens by restating the title; no "Introduction" header
- Contractions present; paragraphs 1–3 lines
- H2-as-question scaffolding, each answered in the first line below it
- At least one "Let's" transition per major section
- Opinions flagged ("I think," "For me")
- No hype vocabulary ("blazing," "game-changing"), no marketing CTA
- Every named signal/method exists in the verified facts above — no inventions

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/blog/2026-08-26-what-inject-agent-returns.mdx
git commit -m "feat(website): add 'What injectAgent() Actually Returns' blog post"
```

---

### Task 2: Validate content and site tests

**Files:**
- No new files; runs existing suites.

- [ ] **Step 1: Verify frontmatter parses and description length**

```bash
cd apps/website && node -e "
const matter = require('gray-matter');
const fs = require('fs');
const f = matter(fs.readFileSync('content/blog/2026-08-26-what-inject-agent-returns.mdx','utf8'));
console.log('desc length:', f.data.description.length);
if (f.data.description.length > 155) throw new Error('description too long');
if (!f.data.title || !f.data.date || f.data.author !== 'brian') throw new Error('frontmatter incomplete');
console.log('OK');
"
```

Expected: `desc length: <n>` (≤155) then `OK`. If `gray-matter` isn't resolvable this way, check how `apps/website/src/lib/blog.ts` imports it and mirror that.

- [ ] **Step 2: Run the website test suite**

`nx test website` does NOT exist (fails silently) — use vitest directly:

```bash
cd apps/website && npx vitest run --config vite.config.mts
```

Expected: all suites pass, including `src/lib/blog.spec.ts` and `src/lib/sitemap-dates.spec.ts`. If a blog spec fails on the new file, fix the post's frontmatter to match what the spec asserts — do not change the spec.

- [ ] **Step 3: Render check in the dev server**

Start the website dev server (use the repo's existing launch config or `npx next dev` from `apps/website`), then load `http://localhost:3000/blog/what-inject-agent-returns` in the browser preview. Verify:

- The post renders (no MDX compile error page)
- The `<Callout>` renders as a styled callout, not raw JSX
- The code block renders with highlighting
- The meta description in `<head>` matches the frontmatter (view source or read_page)

Stop the dev server when done.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A apps/website/content/blog/
git commit -m "fix(website): render fixes for injectAgent post"
```

Skip if Step 3 needed no changes.

---

### Task 3: PR

**Files:**
- None; git/GitHub operations only.

- [ ] **Step 1: Push the branch and open a PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(website): add 'What injectAgent() Actually Returns' blog post" --body "First post of the GSC-driven blog sequence (spec: docs/superpowers/specs/2026-08-26-blog-sequence-inject-agent-design.md).

Targets the \`injectagent\` query — the site's top striking-distance query (108 impressions, position 5.6) — with the conceptual 'what is this for' post; links to (does not replace) the API reference page.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 2: Verify the Vercel preview**

Only `Vercel – threadplane` gates merge. Wait for the preview deployment, open the preview URL's `/blog/what-inject-agent-returns`, and confirm the post renders and appears on `/blog`. Report the preview URL to Brian for final read-through before merge — the post carries his byline, so he approves the prose before it ships.
