# Cockpit Angular Examples — Chat Integration (Phase 1)

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Wire all 13 remaining cockpit Angular examples to correctly consume `@cacheplane/chat`, make each buildable and serveable as a standalone Angular app.

---

## Overview

Apply the streaming example's proven pattern to all 13 remaining cockpit Angular examples. Each becomes a standalone Angular app with correct `@cacheplane/chat` API usage, Angular CLI build/serve targets, and proxy configuration to its LangGraph backend.

Phase 2 (separate spec) will customize each example with capability-specific content, docs, and backend integration.

## Pattern (from streaming example)

Each example gets:
1. Delete duplicate `src/app.component.ts` + `src/app.config.ts`
2. Rewrite capability component: `<chat [ref]="stream">` (or `<chat-debug [ref]="stream">` for deep-agents)
3. `app.config.ts` with `provideStreamResource` + `provideChat`
4. `main.ts` bootstrapping the capability component
5. `project.json` with `@angular-devkit/build-angular:application` build + `dev-server` serve
6. `tsconfig.app.json` with `lib: ["es2022", "dom"]` + `emitDeclarationOnly: false`
7. `index.html` with `<base href="/">` and correct selector
8. Development environment using `/api` proxy

## Capability → Chat Component Mapping

| Example | Selector | Chat Component | Capability-Specific Additions |
|---|---|---|---|
| persistence | `app-persistence` | `<chat>` | `[threads]`, `[activeThreadId]`, `(threadSelected)` inputs for thread management |
| interrupts | `app-interrupts` | `<chat>` | `ChatInterruptPanelComponent` rendered when `stream.interrupt()` is defined |
| memory | `app-memory` | `<chat>` | `[threads]` for cross-thread state |
| time-travel | `app-time-travel` | `<chat>` | `ChatTimelineSliderComponent` for checkpoint navigation |
| subgraphs | `app-subgraphs` | `<chat>` | `ChatSubagentCardComponent` for nested agent tracking |
| durable-execution | `app-durable-execution` | `<chat>` | Error/retry patterns via `stream.error()` + `stream.reload()` |
| deployment-runtime | `app-deployment-runtime` | `<chat>` | Production config (different assistant ID) |
| planning | `app-planning` | `<chat-debug>` | Full debug composition |
| filesystem | `app-filesystem` | `<chat-debug>` | Full debug composition |
| subagents (DA) | `app-subagents` | `<chat-debug>` | Full debug composition |
| memory (DA) | `app-da-memory` | `<chat-debug>` | Full debug composition |
| skills | `app-skills` | `<chat-debug>` | Full debug composition |
| sandboxes | `app-sandboxes` | `<chat-debug>` | Full debug composition |

## Port Assignment

| Example | Port | Proxy Target |
|---|---|---|
| streaming | 4300 | localhost:8123 |
| persistence | 4301 | localhost:8124 |
| interrupts | 4302 | localhost:8125 |
| memory | 4303 | localhost:8126 |
| time-travel | 4304 | localhost:8127 |
| subgraphs | 4305 | localhost:8128 |
| durable-execution | 4306 | localhost:8129 |
| deployment-runtime | 4307 | localhost:8130 |
| planning | 4310 | localhost:8140 |
| filesystem | 4311 | localhost:8141 |
| subagents (DA) | 4312 | localhost:8142 |
| memory (DA) | 4313 | localhost:8143 |
| skills | 4314 | localhost:8144 |
| sandboxes | 4315 | localhost:8145 |

## Files Changed Per Example (7 files each)

For each of the 13 examples:
- Delete: `src/app.component.ts`, `src/app.config.ts` (root duplicates)
- Rewrite: `src/app/{capability}.component.ts`
- Rewrite: `src/app/app.config.ts`
- Rewrite: `src/main.ts`
- Rewrite: `project.json`
- Update: `tsconfig.app.json`
- Update: `src/index.html`
- Update: `src/environments/environment.development.ts`
- Add: `proxy.conf.json` (if missing)
