# Library Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the empty `@cacheplane/stream-resource` directory and update all stale references so the monorepo reflects 3 libraries (angular, render, chat).

**Architecture:** Delete empty dir, find-and-replace references in README, LICENSE-COMMERCIAL, and cockpit docs.

**Tech Stack:** Git, Markdown, Python docs

---

### Task 1: Delete Empty libs/stream-resource Directory

**Files:**
- Delete: `libs/stream-resource/` (contains only `node_modules/`)

- [ ] **Step 1: Remove the directory**

```bash
rm -rf libs/stream-resource
```

- [ ] **Step 2: Verify removal**

```bash
ls libs/ | grep stream-resource
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add -A libs/stream-resource
git commit -m "chore: remove empty libs/stream-resource directory"
```

---

### Task 2: Update README.md

**Files:**
- Modify: `README.md`

Replace all `streamResource()` references with `agent()`. Update tagline from "Streaming Resource" to "Angular Agent Framework". Update the 30-Second Example, Feature Comparison table, and Architecture section to use `agent()`.

- [ ] **Step 1: Update hero alt text and tagline**

Old: `The Enterprise Streaming Resource for LangChain and Angular`
New: `The Angular Agent Framework for LangChain`

- [ ] **Step 2: Update 30-Second Example**

Replace `streamResource<{ messages: BaseMessage[] }>({...})` with `agent<{ messages: BaseMessage[] }>({...})`. Update import from `streamResource` to `agent`.

- [ ] **Step 3: Update Feature Comparison table**

Replace `streamResource() (Angular)` with `agent() (Angular)` in the header row.

- [ ] **Step 4: Update Architecture section**

Replace all `streamResource()` with `agent()` in the architecture description.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README to use agent() instead of streamResource()"
```

---

### Task 3: Update LICENSE-COMMERCIAL

**Files:**
- Modify: `LICENSE-COMMERCIAL`

- [ ] **Step 1: Update URL**

Replace `https://stream-resource.dev/pricing` with `https://cacheplane.ai/pricing`.

- [ ] **Step 2: Commit**

```bash
git add LICENSE-COMMERCIAL
git commit -m "docs: update LICENSE-COMMERCIAL URL to cacheplane.ai"
```

---

### Task 4: Update Cockpit Python Docs

**Files:**
- Modify: `cockpit/chat/timeline/python/src/graph.py`
- Modify: `cockpit/chat/timeline/python/prompts/timeline.md`
- Modify: `cockpit/chat/timeline/python/docs/guide.md`
- Modify: `cockpit/chat/threads/python/docs/guide.md`
- Modify: `cockpit/chat/subagents/python/docs/guide.md`
- Modify: `cockpit/chat/interrupts/python/docs/guide.md`
- Modify: `cockpit/chat/input/python/docs/guide.md`
- Modify: `cockpit/render/spec-rendering/python/docs/guide.md`
- Modify: `cockpit/render/repeat-loops/python/docs/guide.md`
- Modify: `cockpit/render/element-rendering/python/docs/guide.md`
- Modify: `cockpit/render/computed-functions/python/docs/guide.md`

- [ ] **Step 1: Update all cockpit references**

In code examples: `streamResource({` → `agent({`
In prose: "stream-resource" → "agent", "stream resource" → "agent", "The stream resource" → "The agent ref"

- [ ] **Step 2: Commit**

```bash
git add cockpit/
git commit -m "docs: update cockpit guides from streamResource to agent"
```

---

### Task 5: Flag SVG Assets

**Files:**
- Note: `apps/website/public/assets/hero.svg`
- Note: `apps/website/public/assets/arch-diagram.svg`

These contain embedded "streamResource" text. They are generated assets that need manual regeneration — not text-editable. Add a TODO comment or note for future regeneration.

- [ ] **Step 1: Verify SVG references**

Confirm these are the only SVG files with stale references.

- [ ] **Step 2: No code change needed** — flag in PR description for future regeneration.
