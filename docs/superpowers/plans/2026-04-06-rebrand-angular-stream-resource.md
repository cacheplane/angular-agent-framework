# Rebrand to "Angular Agent Framework" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all brand/product-name occurrences of "Agent" and "angular" with "Angular Agent Framework" across marketing, docs, and licensing — without touching code, npm packages, domains, or infrastructure.

**Architecture:** Pure text replacement across ~15 files. No code changes, no build system changes, no infrastructure changes. The Angular library `agent()` function, all types, imports, file names, domains, and npm packages remain exactly as-is.

**Tech Stack:** Markdown, TSX (Next.js website components), plain text (license)

**Decision Rule:** If "Agent" or "angular" appears inside a code block, import statement, URL, file path, package.json `name` field, or refers to a function/type/interface — do NOT change it. Only change it when it's used as a product name in prose, headings, titles, or marketing copy.

---

### Task 1: License and Commercial Files

**Files:**
- Modify: `COMMERCIAL.md:6`
- Modify: `README.md:4,151`

- [ ] **Step 1: Update COMMERCIAL.md license title**

In `COMMERCIAL.md`, line 6, change:

```
- **Agent Commercial License** — required for commercial use (see [`LICENSE-COMMERCIAL`](./LICENSE-COMMERCIAL))
```

to:

```
- **Angular Agent Framework Commercial License** — required for commercial use (see [`LICENSE-COMMERCIAL`](./LICENSE-COMMERCIAL))
```

- [ ] **Step 2: Update README.md license section**

In `README.md`, line 151, change:

```
- **Agent Commercial License** — required for any for-profit or revenue-generating use. See [`LICENSE-COMMERCIAL`](./LICENSE-COMMERCIAL) and [`COMMERCIAL.md`](./COMMERCIAL.md).
```

to:

```
- **Angular Agent Framework Commercial License** — required for any for-profit or revenue-generating use. See [`LICENSE-COMMERCIAL`](./LICENSE-COMMERCIAL) and [`COMMERCIAL.md`](./COMMERCIAL.md).
```

Note: `LICENSE-COMMERCIAL` itself does NOT use "Agent" as a product name (only `@cacheplane/angular` as a package name), so it requires no changes.

- [ ] **Step 3: Commit**

```bash
git add COMMERCIAL.md README.md
git commit -m "docs: rebrand license references to Angular Agent Framework"
```

---

### Task 2: README Brand Text

**Files:**
- Modify: `README.md:4,114`

- [ ] **Step 1: Update README hero alt text**

In `README.md`, line 4, change:

```
    alt="angular — The Enterprise Streaming Resource for LangChain and Angular"
```

to:

```
    alt="Angular Agent Framework — The Enterprise Streaming Resource for LangChain and Angular"
```

- [ ] **Step 2: Update README architecture alt text**

In `README.md`, line 114, change:

```
    alt="angular architecture: Angular Component → agent() → StreamManager Bridge → LangGraph Platform, with signals returned reactively"
```

to:

```
    alt="Angular Agent Framework architecture: Angular Component → agent() → StreamManager Bridge → LangGraph Platform, with signals returned reactively"
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rebrand README hero and architecture alt text"
```

---

### Task 3: Website Layout Metadata

**Files:**
- Modify: `apps/website/src/app/layout.tsx:25`

- [ ] **Step 1: Update page title**

In `apps/website/src/app/layout.tsx`, line 25, change:

```typescript
  title: 'Agent — LangChain Streaming for Angular',
```

to:

```typescript
  title: 'Angular Agent Framework — LangChain Streaming for Angular',
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/app/layout.tsx
git commit -m "docs: rebrand website page title to Angular Agent Framework"
```

---

### Task 4: Website Navigation

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx:52`

- [ ] **Step 1: Update Nav brand text**

In `apps/website/src/components/shared/Nav.tsx`, line 52, change:

```tsx
          Agent
```

to:

```tsx
          Angular Agent Framework
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx
git commit -m "docs: rebrand nav header to Angular Agent Framework"
```

---

### Task 5: Website Footer

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx:43,44,130`

- [ ] **Step 1: Update Footer brand heading**

In `apps/website/src/components/shared/Footer.tsx`, line 43, change:

```tsx
            <p className="font-garamond text-xl font-bold mb-2" style={{ color: tokens.colors.textPrimary }}>Agent</p>
```

to:

```tsx
            <p className="font-garamond text-xl font-bold mb-2" style={{ color: tokens.colors.textPrimary }}>Angular Agent Framework</p>
```

- [ ] **Step 2: Update Footer copyright**

In `apps/website/src/components/shared/Footer.tsx`, line 130, change:

```tsx
          <span>&copy; {new Date().getFullYear()} Agent. All rights reserved.</span>
```

to:

```tsx
          <span>&copy; {new Date().getFullYear()} Angular Agent Framework. All rights reserved.</span>
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "docs: rebrand footer to Angular Agent Framework"
```

---

### Task 6: Website Landing Page Components

**Files:**
- Modify: `apps/website/src/components/landing/ProblemSection.tsx:288`
- Modify: `apps/website/src/components/landing/GenerativeUIFrame.tsx:30`

- [ ] **Step 1: Update ProblemSection brand reference**

In `apps/website/src/components/landing/ProblemSection.tsx`, line 288, change:

```tsx
            Agent closes the gap
```

to:

```tsx
            Angular Agent Framework closes the gap
```

- [ ] **Step 2: Update GenerativeUIFrame aria-label**

In `apps/website/src/components/landing/GenerativeUIFrame.tsx`, line 30, change:

```tsx
      aria-label="Animated demo of angular orchestrating a multi-step agent UI"
```

to:

```tsx
      aria-label="Animated demo of Angular Agent Framework orchestrating a multi-step agent UI"
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/ProblemSection.tsx apps/website/src/components/landing/GenerativeUIFrame.tsx
git commit -m "docs: rebrand landing page components to Angular Agent Framework"
```

---

### Task 7: LLMs.txt Route

**Files:**
- Modify: `apps/website/src/app/llms.txt/route.ts:8,10`

- [ ] **Step 1: Update llms.txt header**

In `apps/website/src/app/llms.txt/route.ts`, line 8, change:

```typescript
    `# angular v${version}`,
```

to:

```typescript
    `# Angular Agent Framework v${version}`,
```

- [ ] **Step 2: Update llms.txt description**

In `apps/website/src/app/llms.txt/route.ts`, line 10, change:

```typescript
    "Angular streaming library for LangChain/LangGraph. Provides agent() — full parity with React's useStream() hook, built on Angular Signals.",
```

to:

```typescript
    "Angular Agent Framework — the enterprise streaming library for LangChain/LangGraph. Provides agent() — full parity with React's useStream() hook, built on Angular Signals.",
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/llms.txt/route.ts
git commit -m "docs: rebrand llms.txt to Angular Agent Framework"
```

---

### Task 8: Documentation Files — Titles and Headings

**Files:**
- Modify: `docs/limitations.md:1`
- Modify: `docs/superpowers/specs/2026-03-17-angular-design.md:1,5,11`
- Modify: `docs/superpowers/specs/2026-03-18-agentic-docs-design.md:1,11`
- Modify: `docs/superpowers/specs/2026-03-18-website-branding-design.md:1,11`
- Modify: `docs/superpowers/specs/2026-04-04-expanded-introduction-design.md:18`

- [ ] **Step 1: Update docs/limitations.md title**

Line 1, change:

```markdown
# Agent — Angular Limitations vs React useStream()
```

to:

```markdown
# Angular Agent Framework — Limitations vs React useStream()
```

- [ ] **Step 2: Update angular-design.md brand references**

In `docs/superpowers/specs/2026-03-17-angular-design.md`:

Line 1, change:
```markdown
# Agent — Design Specification
```
to:
```markdown
# Angular Agent Framework — Design Specification
```

Line 11, change:
```markdown
Agent is an Angular 20+ library that provides `agent()` — a full-parity implementation
```
to:
```markdown
Angular Agent Framework is an Angular 20+ library that provides `agent()` — a full-parity implementation
```

- [ ] **Step 3: Update agentic-docs-design.md brand references**

In `docs/superpowers/specs/2026-03-18-agentic-docs-design.md`:

Line 1, change:
```markdown
# Agent — Agentic Docs & Hero Redesign Specification
```
to:
```markdown
# Angular Agent Framework — Agentic Docs & Hero Redesign Specification
```

Line 11, change:
```markdown
Two related changes to the Agent website:
```
to:
```markdown
Two related changes to the Angular Agent Framework website:
```

- [ ] **Step 4: Update website-branding-design.md brand references**

In `docs/superpowers/specs/2026-03-18-website-branding-design.md`:

Line 1, change:
```markdown
# Agent Website — Brand Refresh Design Specification
```
to:
```markdown
# Angular Agent Framework Website — Brand Refresh Design Specification
```

Line 11, change:
```markdown
Update the Agent website design from its original warm "dark luxury" aesthetic
```
to:
```markdown
Update the Angular Agent Framework website design from its original warm "dark luxury" aesthetic
```

- [ ] **Step 5: Update expanded-introduction-design.md brand reference**

In `docs/superpowers/specs/2026-04-04-expanded-introduction-design.md`:

Line 18, change:
```markdown
### Section 1: What is Agent?
```
to:
```markdown
### Section 1: What is Angular Agent Framework?
```

- [ ] **Step 6: Commit**

```bash
git add docs/limitations.md docs/superpowers/specs/2026-03-17-angular-design.md docs/superpowers/specs/2026-03-18-agentic-docs-design.md docs/superpowers/specs/2026-03-18-website-branding-design.md docs/superpowers/specs/2026-04-04-expanded-introduction-design.md
git commit -m "docs: rebrand spec and doc titles to Angular Agent Framework"
```

---

### Task 9: AGENTS.md and CLAUDE.md (LLM Context Files)

**Files:**
- Modify: `apps/website/public/AGENTS.md:1`
- Modify: `apps/website/public/CLAUDE.md:1`

Both files have identical content. They serve as LLM context files published to the website.

- [ ] **Step 1: Update AGENTS.md header**

In `apps/website/public/AGENTS.md`, line 1, change:

```markdown
# angular v0.0.1
```

to:

```markdown
# Angular Agent Framework v0.0.1
```

- [ ] **Step 2: Update CLAUDE.md header**

In `apps/website/public/CLAUDE.md`, line 1, change:

```markdown
# angular v0.0.1
```

to:

```markdown
# Angular Agent Framework v0.0.1
```

Note: All other references in these files (`agent()`, `provideAgent`, `import ... from 'angular'`, `@angular/mcp`, `stream-resource.dev`) are code/infrastructure references and should NOT be changed.

- [ ] **Step 3: Commit**

```bash
git add apps/website/public/AGENTS.md apps/website/public/CLAUDE.md
git commit -m "docs: rebrand LLM context file headers to Angular Agent Framework"
```

---

### Task 10: Remaining Spec/Plan Files with Brand References

**Files:**
- Search all files in `docs/superpowers/specs/` and `docs/superpowers/plans/` for "Agent" used as a product name in prose (not in code blocks)

- [ ] **Step 1: Grep for remaining brand references**

Run:
```bash
grep -rn "Agent" docs/superpowers/specs/ docs/superpowers/plans/ --include="*.md" | grep -v "agent\|AgentRef\|AgentOptions\|AgentConfig\|AgentTransport\|MockAgent\|provideAgent\|addAgent\|handleAddAgent\|STREAM_RESOURCE\|rebrand-angular"
```

This filters out all code references, leaving only brand usage.

- [ ] **Step 2: Update any remaining brand references found**

For each match from Step 1, apply the same rule: if "Agent" is used as a product name in prose/headings, change to "Angular Agent Framework". If it's inside a code block or refers to a function/type, leave it.

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: rebrand remaining spec references to Angular Agent Framework"
```

---

### Task 11: Verify Build and Final Grep

- [ ] **Step 1: Build the website**

Run:
```bash
npx nx build website
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Build the Angular library (sanity check)**

Run:
```bash
npx nx build angular
```

Expected: Build succeeds (no changes were made to library code).

- [ ] **Step 3: Final grep for missed brand references**

Run:
```bash
grep -rn "Agent" --include="*.md" --include="*.tsx" --include="*.ts" --include="*.html" . | grep -v node_modules | grep -v dist | grep -v ".angular" | grep -v "agent\|AgentRef\|AgentOptions\|AgentConfig\|AgentTransport\|MockAgent\|provideAgent\|addAgent\|handleAddAgent\|STREAM_RESOURCE_CONFIG\|rebrand-angular"
```

Review each match. Any brand usage of "Agent" remaining should be updated.

- [ ] **Step 4: Final grep for "angular" as brand**

Run:
```bash
grep -rn '"angular' --include="*.md" --include="*.tsx" --include="*.ts" . | grep -v node_modules | grep -v dist | grep -v "package\|import\|from\|require\|cacheplane\|/libs/\|/apps/\|tsconfig\|project.json\|\.dev"
```

Review each match. Any brand usage (not package name, not URL, not file path) should be updated.

- [ ] **Step 5: Commit any final fixes if needed**

```bash
git add -A
git commit -m "docs: fix any remaining brand references missed in initial pass"
```
