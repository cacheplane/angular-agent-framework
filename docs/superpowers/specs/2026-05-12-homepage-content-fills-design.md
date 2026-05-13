# Homepage content fills — ProofStrip / Promises / HomeFAQ

**Date:** 2026-05-12 (revised after PR #275 landed)
**Scope:** Editorial pass on three landing components shipped in PR #270. Fill gaps identified in the full analysis: missing ProofStrip claim line, redundant adapter signal, undersold npm signal, two overlapping Promises (now consolidated), two new Promises (telemetry, model lock-in), softened HomeFAQ Q1 (CopilotKit claim) and Q-production (production-ready), three new HomeFAQ entries (CopilotKit migration, Angular Universal / SSR, testing).

**Out of scope:** Hero, Differentiator, Stream/Render/Ship FeatureBlocks, PilotBlock, WhitePaperBlock, FinalCTA. Screenshot pipeline (separate workstream). The broken `/docs/agent/guides/production` link in the Ship block (flagged for a follow-up task).

**Baseline:** This spec is written against `origin/main` after PR #275 (`refactor(website): editorial sweep — drop zoneless claims, honest LTS commitment`) landed. #275 already:
- Dropped all "zoneless" claims sitewide (ProofStrip signal #2 became `Built for / Angular 20+`; HomeFAQ Q1 lost the `zoneless support` mention; HomeFAQ's `Is it zoneless-compatible?` question was removed).
- Locked the LTS commitment phrasing to `We support Angular's current and previous LTS versions.` in both Promises card 2 and HomeFAQ Q-production.

This spec does **not** reintroduce any "zoneless" language, and **uses #275's LTS phrasing verbatim** where it overlaps.

---

## Files touched

- `apps/website/src/components/landing/ProofStrip.tsx`
- `apps/website/src/components/landing/Promises.tsx`
- `apps/website/src/components/landing/HomeFAQ.tsx`

No new components. No structural changes — data-array edits plus one new heading element in ProofStrip.

---

## 1. ProofStrip

### Add a claim line

Insert a single sentence between the existing `Eyebrow` ("Built in the open") and the signals grid:

> **Open code, open packages, a live reference app.**

Styling: render as a centered `<p>` (not a section h2) using `tokens.typography.bodyLg`, `fontWeight: 600`, `color: tokens.colors.textPrimary`, with the existing `Eyebrow` keeping its current spacing above and the signals grid retaining its spacing below. This keeps ProofStrip's `tight` Section rhythm — the claim is an emphasis line, not a new section heading.

### Replace signal #3 (currently redundant)

| Field | Current on main | New |
|---|---|---|
| `label` | `LangGraph + AG-UI` | `Adapter contract` |
| `value` | `Two adapters` | `LangGraph + AG-UI + your own` |
| `href` | `null` | `null` |

### Reframe signal #5 (currently undersells the package family)

| Field | Current on main | New |
|---|---|---|
| `label` | `On npm` | `On npm` |
| `value` | `@ngaf/chat` | `@ngaf/* — 7 packages` |
| `href` | `https://www.npmjs.com/package/@ngaf/chat` | `https://www.npmjs.com/search?q=%40ngaf` |

(`7 packages` = current count of non-private `libs/*/package.json` files: a2ui, ag-ui, chat, langgraph, licensing, partial-json, render. Update if the count drifts before merge.)

### Do NOT touch signal #2

Signal #2 on main is `Built for / Angular 20+` (post-#275). Keep it byte-identical. Do not reintroduce `Zoneless ready`.

---

## 2. Promises

Full replacement of the `PROMISES` array. Same shape (`{ title, body }`), same card count (5), same section heading and surrounding copy.

```ts
const PROMISES = [
  {
    title: 'No closed core',
    body: 'MIT today, MIT tomorrow. Primitives and compositions both stay in the open repo. Pilot-to-Prod is the only paid thing.',
  },
  {
    title: 'No abandoned majors',
    body: 'We support Angular’s current and previous LTS versions.',
  },
  {
    title: 'No required cloud',
    body: 'Self-host LangGraph + your Angular app. Run it all in your VPC.',
  },
  {
    title: 'No telemetry',
    body: 'We don’t collect anything from your app. Not at install, not at runtime.',
  },
  {
    title: 'No model lock-in',
    body: 'Adapters work with any LLM your runtime supports. Swap providers without changing Angular code.',
  },
];
```

Beat changes vs current main:
- Old `No vendor lock-in` + `No paid Angular tier` + `No closed primitives` → consolidated into new `No closed core` (one distinct beat instead of three overlapping ones).
- `No abandoned majors` body is **byte-identical to #275's wording** — kept unchanged on purpose.
- Old `No required cloud` body reworded from "No phone-home" to "Run it all in your VPC" — leaves "phone-home" framing to the new `No telemetry` card.
- New `No telemetry` — explicit promise that matches the `FinalCTA` caption.
- New `No model lock-in` — net-new beat not duplicated upstream.

---

## 3. HomeFAQ

Full replacement of the `ITEMS` array. Same shape (`FAQItem[]`), expands from **7 to 10** entries (main has 7 after #275 removed the zoneless question). Two existing answers reworded; three new questions appended.

```ts
const ITEMS: FAQItem[] = [
  {
    q: 'How is this different from CopilotKit or AG-UI directly?',
    a: 'CopilotKit has an Angular SDK; ours is built around signals and DI as the substrate, not a port. AG-UI is a protocol, not a UI library — you still build the Angular side. Angular Agent Framework gives you signal-native primitives plus adapters that hide the protocol, so you can swap LangGraph for AG-UI without rewriting your UI.',
  },
  // Q2 unchanged: existing-app
  // Q3 unchanged: without LangGraph
  // Q4 unchanged: P2P required
  // Q5 unchanged: cost
  {
    q: 'Is this production-ready today?',
    a: 'It runs the full stack in our reference deployment (cockpit.cacheplane.ai), and breaking changes are called out in release notes. We support Angular’s current and previous LTS versions.',
  },
  // Q7 unchanged: where to report issues
  {
    q: 'I’m using CopilotKit today — how hard is the migration?',
    a: 'Component-by-component. CopilotKit’s chat hooks have rough equivalents in our `agent()` signal API, and CopilotKit actions map to LangGraph/AG-UI tool calls. Thread state lives in a service (not the component tree), so plan a session to port that. There isn’t a one-shot codemod.',
  },
  {
    q: 'Does it work with Angular Universal / SSR?',
    a: 'Streaming is client-side by design — agents are stateful and signal-based. If your shell is SSR’d, the agent-talking parts stay client-only; render fallbacks during hydration via standard Angular SSR patterns.',
  },
  {
    q: 'How do I test agent-driven components?',
    a: 'The agent is provided through Angular DI, so test doubles work the way you’re used to — supply a stub agent in your test module, drive it with signals, assert on the rendered output. See /docs/agent/guides/testing.',
  },
];
```

Final order (10 entries): Q1 (reworded) → Q2 → Q3 → Q4 → Q5 → Q6-production (reworded) → Q7-report-issues → Q8 (new migration) → Q9 (new SSR) → Q10 (new testing).

Edits in detail (vs current main):
- **Q1:** softens "CopilotKit ports React patterns to Angular" — replaced with the substrate-not-port framing. Deliberately does **not** mention "zoneless" (per #275).
- **Q6-production-ready:** drops the unqualified "Yes —" opener, leads with deployment evidence and release-notes commitment, then keeps **#275's LTS phrasing verbatim** as the closer.
- **Q8 (new):** the obvious follow-up to Q1. The most commercially-relevant question this section can answer. Phrased to hedge on the CopilotKit Angular SDK API surface ("rough equivalents") rather than naming specific hooks I can't verify.
- **Q9 (new):** SSR is a hard-stop for many enterprise Angular shops. Silence reads as "doesn't support it." Honest answer with a known boundary (agent parts stay client-only) and a pointer at standard SSR-fallback patterns, without claiming a specific built-in loading-state primitive.
- **Q10 (new):** Angular teams care about testing; silence here suggests it's hard. Links to existing `apps/website/content/docs/agent/guides/testing.mdx`.

---

## Verification

- Visit `/` in the preview dev server (if available), confirm ProofStrip claim renders above the cards, Promises shows the new 5-card lineup, FAQ shows 10 items in the expected order.
- Verify the new signal #5 link (`npm search ?q=%40ngaf`) opens to a populated results page.
- Verify the `/docs/agent/guides/testing` link from Q10 resolves (file exists on disk).
- Verify the `/pricing` link from the unchanged Q5 still resolves.
- `npx nx run website:lint` and `npx prettier --check` pass on all three modified files.
- `nx run website:build` is blocked by a pre-existing `posthog-node` missing-dependency issue in this worktree — track separately, not a blocker for this PR if the same build runs clean on CI.

## Risk / rollback

Single PR, three file edits, no schema or shape changes. Rollback is `git revert`. No dependencies on screenshot work or other in-flight PRs. The branch must be rebased onto `origin/main` so #275's edits are the baseline and there's no merge conflict left over.
