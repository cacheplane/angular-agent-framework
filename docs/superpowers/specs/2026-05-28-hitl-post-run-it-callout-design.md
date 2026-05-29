# Feature the HITL post + "Run it yourself" card group

**Status:** Design approved · small change
**Date:** 2026-05-28

## Goal

Make the HITL refund post the featured post on `/blog`, and add a two-card "Run it yourself" group inside the post linking to the live cockpit demo and the GitHub source directory.

## Changes

### 1. Feature flag

In `apps/website/content/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx`, set `featured: true`.

`getFeaturedPost()` returns the newest post with `featured: true`. The HITL post is dated 2026-05-25 (newest), so it becomes the featured card at the top of `/blog`. The AG-UI (2026-05-21) and streaming (2026-05-17) posts keep their `featured: true` flags but fall into the grid behind it. No code change required.

### 2. `<Card external>` prop

In `apps/website/src/components/docs/mdx/Card.tsx`, add an optional `external?: boolean` prop. When true, the underlying link renders with `target="_blank"` and `rel="noopener noreferrer"`. Backward compatible — existing internal `<Card>` usages are unaffected (default `external = false`).

Next.js `<Link>` passes `target`/`rel` through to the rendered anchor, so this is a prop pass-through, not a structural change.

### 3. The card group in the post

Insert right after the intro paragraph (the one ending "…run `nx serve cockpit-langgraph-interrupts-angular`, and follow along."):

```mdx
<CardGroup cols={2}>
  <Card title="Run the live demo" icon="▶" external href="https://cockpit.threadplane.ai/langgraph/core-capabilities/interrupts/overview/python">
    The refund agent running in the cockpit. Walk the approve / edit / cancel flow yourself.
  </Card>
  <Card title="View the source" icon="⌥" external href="https://github.com/cacheplane/angular-agent-framework/tree/main/cockpit/langgraph/interrupts">
    The exact graph.py and Angular component from this post.
  </Card>
</CardGroup>
```

`CardGroup` and `Card` are already registered in `MdxRenderer`'s component map; no import needed in the MDX.

## Destinations

- Live demo: `https://cockpit.threadplane.ai/langgraph/core-capabilities/interrupts/overview/python`
- Source: `https://github.com/cacheplane/angular-agent-framework/tree/main/cockpit/langgraph/interrupts`

## Out of scope

- No bespoke callout/banner/terminal component (Options B/C dropped).
- No second placement of the card group elsewhere in the post.
- No changes to the other two posts.
- No change to `getFeaturedPost` logic.

## Definition of done

- HITL post renders as the featured card at the top of `/blog`.
- The card group renders after the intro; both cards open in a new tab.
- `<Card external>` works without breaking existing internal Card usages.
- `nx lint website` / `nx test website` clean.

## Files touched

- `apps/website/content/blog/2026-05-25-human-in-the-loop-langgraph-agents-in-angular.mdx` (frontmatter + card group)
- `apps/website/src/components/docs/mdx/Card.tsx` (external prop)
