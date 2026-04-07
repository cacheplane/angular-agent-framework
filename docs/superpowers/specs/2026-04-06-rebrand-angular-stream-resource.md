# Rebrand to "Angular Agent Framework" — Design Specification

## Overview

Rename the product brand from "Agent" / "angular" to **Angular Agent Framework** across all marketing, documentation, and licensing materials. The Angular library code, npm package, domain, and infrastructure remain unchanged.

## Motivation

Angular 20 introduced `rxResource` with a `stream` property, which the official docs call a "Streaming Resource." The current product name "Agent" collides with this first-party terminology, creating confusion about whether the product is an official Angular package. Rebranding to "Angular Agent Framework" makes the name explicitly descriptive, positions it as the Angular-ecosystem standard for LLM streaming, and avoids ambiguity with the built-in API.

## Brand Identity

| Attribute | Value |
|-----------|-------|
| Full product name | Angular Agent Framework |
| Parent brand | Cacheplane |
| npm package | `@cacheplane/angular` (unchanged) |
| Domain | `stream-resource.dev` (unchanged) |
| Tagline | "The Enterprise Streaming Resource for LangChain and Angular" (unchanged) |

## Scope

### What Changes

Brand-layer text only. All changes are string replacements in documentation and marketing files.

**Pattern:** Replace "Agent" (PascalCase, used as a product name) with "Angular Agent Framework" in prose contexts. Do NOT replace it in code contexts (function names, type names, imports, injection tokens).

#### 1. License Files
- `LICENSE-COMMERCIAL`: "Agent Commercial License" -> "Angular Agent Framework Commercial License"
- `COMMERCIAL.md`: All product name references

#### 2. README
- Hero image alt text: "angular — The Enterprise Streaming Resource..." -> "Angular Agent Framework — The Enterprise Streaming Resource..."
- Any prose references to the product name

#### 3. Website (apps/website)
- Page `<title>` and meta tags: "Agent — ..." -> "Angular Agent Framework — ..."
- Hero section headings
- Navigation/footer brand references
- Open Graph / social meta tags

#### 4. Documentation Files (docs/)
- Document titles where "Agent" appears as a product name (e.g., "Agent — Angular Limitations..." -> "Angular Agent Framework — Angular Limitations...")
- Design specs that reference the product name in headings/descriptions

#### 5. Cockpit Example Guides (cockpit/**/docs/guide.md)
- Product description references in example documentation

#### 6. AGENTS.md
- Any product name references in contributor documentation

### What Does NOT Change

| Category | Examples | Reason |
|----------|----------|--------|
| Function names | `agent()` | Code API identity |
| Type/interface names | `AgentRef`, `AgentOptions`, `AgentTransport`, `AgentConfig` | Code API identity |
| Injection tokens | `STREAM_RESOURCE_CONFIG` | Code API identity |
| Provider functions | `provideAgent()` | Code API identity |
| Mock utilities | `MockAgentRef`, `createMockAgentRef()` | Code API identity |
| MCP tool functions | `addAgentTool`, `handleAddAgent()` | Code API identity |
| npm package name | `@cacheplane/angular` | Package identity |
| Import paths | `from '@cacheplane/angular'` | Package identity |
| File/directory names | `angular.fn.ts`, `/libs/angular/` | File system identity |
| Nx project names | `angular`, `angular-e2e` | Build system identity |
| TypeScript path aliases | `@cacheplane/angular` in tsconfig | Build system identity |
| Domain URLs | `stream-resource.dev`, `examples.stream-resource.dev` | Infrastructure identity |
| CI/CD workflows | GitHub Actions references | Infrastructure identity |
| package.json `name` fields | `"name": "angular"` | Package identity |

## Decision Rules for Ambiguous Cases

When encountering "Agent" or "angular" in a file, apply this test:

1. **Is it inside a code block, import statement, or referring to an API?** -> Do NOT change.
2. **Is it a package.json `name` or `description` field that serves as an npm identifier?** -> Do NOT change `name`. DO change `description` if it uses "Agent" as a product name.
3. **Is it prose text describing the product to a human reader?** -> Change to "Angular Agent Framework".
4. **Is it a document title/heading naming the product?** -> Change to "Angular Agent Framework".
5. **Is it a URL or domain reference?** -> Do NOT change.

## File Inventory

Estimated ~60 files need changes, distributed as:
- ~30 markdown files (docs, guides, specs, plans)
- ~5 license/commercial files
- ~3 website layout/meta files (TSX/HTML)
- ~20 cockpit example guide files
- ~2 root files (README, AGENTS.md)

## Testing Strategy

- Verify the website builds successfully after changes (`nx build website`)
- Verify the Angular library builds successfully (should be unaffected, but confirm: `nx build angular`)
- Visual check of the website to confirm brand text renders correctly
- Grep for remaining "Agent" instances in prose contexts to confirm completeness

## Rollout

Single PR with all brand text changes. No phased rollout needed since:
- No code changes
- No breaking API changes
- No infrastructure changes
- No domain migration
