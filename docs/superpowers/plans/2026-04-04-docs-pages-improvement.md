# Docs Pages Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 18 docs pages up to the quality level of the introduction page — expanded content, proper MDX components, navigation sections, and consistent design patterns.

**Architecture:** Each task updates one or more MDX files. Changes are content-only (no new components needed). All pages should use: glass Callouts with SVG icons, labeled Tabs, code blocks with copy buttons (automatic via Pre component), and "What's Next" CardGroup at the bottom.

**Baseline:** The introduction page (292 lines) sets the quality bar with: animated diagram, FeatureChips, expanded code examples, Callouts, Steps, Tabs with labels, and CardGroup navigation.

---

## Audit Summary

| Quality | Pages | Action |
|---------|-------|--------|
| **THIN (needs major expansion)** | streaming (53), time-travel (55), subgraphs (59), 4 API stubs (3 each) | Double or triple content |
| **ADEQUATE (needs polish)** | persistence (89), interrupts (78), memory (65), testing (106), deployment (90), langgraph-basics (51), agent-architecture (55) | Add nav section, expand examples, add Callouts |
| **GOOD (minor polish)** | quickstart (130), installation (102), angular-signals (61), state-management (69) | Add nav section where missing |

## Common Improvements for ALL Pages

Every page should get:
1. **"What's Next" CardGroup** at the bottom (links to 2-4 related pages)
2. **At least one Callout** (tip, info, or warning) for key insights
3. **Tab-labeled code examples** where showing TypeScript + Template patterns

---

### Task 1: Expand Streaming Guide (THIN → GOOD)

**File:** `apps/website/content/docs-v2/guides/streaming.mdx`

Expand from 53 to ~120 lines. Add:
- Stream modes explanation (values, messages, events)
- Error handling during streaming
- Throttle configuration
- Template patterns with `@if` / `@for`
- Callout about SSE connection behavior
- "What's Next" CardGroup

---

### Task 2: Expand Time Travel Guide (THIN → GOOD)

**File:** `apps/website/content/docs-v2/guides/time-travel.mdx`

Expand from 55 to ~100 lines. Add:
- UI pattern for building a history timeline
- Tabs showing TypeScript + Template for history display
- Comparing checkpoints
- Callout about debugging workflow
- "What's Next" CardGroup

---

### Task 3: Expand Subgraphs Guide (THIN → GOOD)

**File:** `apps/website/content/docs-v2/guides/subgraphs.mdx`

Expand from 59 to ~100 lines. Add:
- Orchestrator pattern with code example
- Tabs showing TypeScript + Template for subagent UI
- Error handling per subagent
- Callout about when to use subagents vs single agent
- "What's Next" CardGroup

---

### Task 4: Expand API Reference Stubs (THIN → ADEQUATE)

**Files:**
- `apps/website/content/docs-v2/api/angular.mdx`
- `apps/website/content/docs-v2/api/provide-angular.mdx`
- `apps/website/content/docs-v2/api/fetch-stream-transport.mdx`
- `apps/website/content/docs-v2/api/mock-stream-transport.mdx`

Each API page should have a brief intro paragraph and a usage example before the auto-generated content. ~15-20 lines each.

---

### Task 5: Polish Persistence Guide (ADEQUATE → GOOD)

**File:** `apps/website/content/docs-v2/guides/persistence.mdx`

Add:
- "What's Next" CardGroup
- Callout about production persistence patterns
- Tab labels using `label` prop if not already

---

### Task 6: Polish Interrupts Guide (ADEQUATE → GOOD)

**File:** `apps/website/content/docs-v2/guides/interrupts.mdx`

Add:
- Multi-step approval pattern
- "What's Next" CardGroup
- Callout about timeout handling

---

### Task 7: Polish Memory Guide (ADEQUATE → GOOD)

**File:** `apps/website/content/docs-v2/guides/memory.mdx`

Add:
- Tabs for TypeScript + Template patterns
- "What's Next" CardGroup
- Callout about memory best practices

---

### Task 8: Polish Testing Guide (ADEQUATE → GOOD)

**File:** `apps/website/content/docs-v2/guides/testing.mdx`

Add:
- "What's Next" CardGroup
- Integration test example with TestBed

---

### Task 9: Polish Deployment Guide (ADEQUATE → GOOD)

**File:** `apps/website/content/docs-v2/guides/deployment.mdx`

Add:
- "What's Next" CardGroup
- Monitoring/observability section
- CORS configuration callout

---

### Task 10: Polish Concept Pages (ADEQUATE → GOOD)

**Files:**
- `apps/website/content/docs-v2/concepts/langgraph-basics.mdx`
- `apps/website/content/docs-v2/concepts/agent-architecture.mdx`

Add:
- "What's Next" CardGroup to both
- Code examples with Tabs where appropriate

---

### Task 11: Add Navigation to Good Pages

**Files:**
- `apps/website/content/docs-v2/concepts/angular-signals.mdx`
- `apps/website/content/docs-v2/concepts/state-management.mdx`

Add:
- "What's Next" CardGroup (these are the only good pages missing it)

---

### Task 12: Final Build Verification

- [ ] Build website: `npx nx build website --skip-nx-cache`
- [ ] Verify all 19 pages render
- [ ] Spot-check 5 pages for CardGroup, Callouts, and code blocks

---

## Execution Strategy

Tasks 1-3 (THIN pages) are the priority — these need the most work.
Tasks 4-11 are polish passes that can be parallelized.
All tasks are independent of each other.
