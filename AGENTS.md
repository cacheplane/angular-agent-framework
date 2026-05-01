# Contributor Agent Guide

This file is for agents working in this repository. It is contributor-facing, not consumer-facing. Keep decisions grounded in the actual repo state, and prefer project-specific instructions over generic agent habits.

## Scope and Precedence

- This guide is for contributors working in the monorepo.
- Public-facing agent context lives under `apps/website/public/` and exists for package users, docs readers, and external tooling.
- When instructions conflict, prefer the most local project instruction available.
- Treat reference docs and copied workflows as inputs, not as truth. Verify against the codebase before acting.

## Operating Principles

- Do not bluff. If something is uncertain, say what is uncertain and verify it from code, docs, or tooling.
- Do the research yourself when the answer can be found locally or by using current documentation.
- Explore first, then edit. For non-trivial work, inspect the relevant files and form a plan before changing code.
- Use applicable workflow guidance before defaulting to generic implementation habits.
- Keep communication direct, calm, and specific. Avoid performative certainty, unnecessary filler, or aggressive phrasing.

## Planning and Execution

- For simple, localized changes, a brief mental plan is fine.
- For anything that spans multiple files, affects behavior, or has unclear boundaries, inspect the codebase and write out a plan before editing.
- Follow existing patterns unless there is a concrete reason to improve them as part of the task.
- Keep changes scoped to the goal. Do not fold unrelated refactors into the same task unless they are required to make the work coherent.
- If you discover the current approach is wrong, adjust course explicitly instead of forcing the original plan through.

## Commands and Tooling

- Prefer setting the tool's working directory over shell patterns like `cd path && command`. In Codex, pass `workdir` directly to the command tool.
- Use the repo's actual package manager and task runner. This repo uses `npm` at the root and `nx` for workspace tasks.
- Prefer `rg` and `rg --files` for search.
- Prefer non-interactive commands.
- Avoid destructive git operations unless explicitly requested.
- Do not substitute other runners when the repo already defines the right command.

## Repo Layout

- `libs/langgraph`: main Angular library (`@ngaf/langgraph`).
- `apps/website`: docs and marketing site.
- `packages/mcp`: MCP server package (`@ngaf/langgraph-mcp`).
- `e2e/agent-e2e`: end-to-end coverage for the workspace.

## Working in This Repo

- The workspace is Nx-based. Prefer project-scoped commands over broad workspace runs unless the task actually needs broader verification.
- Inspect `project.json`, `nx.json`, and existing scripts before inventing commands.
- If you need Nx-specific syntax or behavior and it is not obvious from local config, verify it from current Nx docs rather than relying on memory.
- The intended always-on LangSmith footprint is one shared cockpit dev deployment. Active capability keys in `deployment-urls.json` may all point at the same URL, and render demos stay local/static.
- Respect generated and public-facing context files. If the task changes docs, API surface, positioning, or package guidance, check whether agent context or docs should be regenerated.

## Docs and Generated Context

- Do not commit generated plans, analyses, or reports unless explicitly requested.
- If docs or public agent guidance changes, check whether `npm run generate-agent-context` should be run.
- If API docs or narrative docs are affected, check whether `npm run generate-api-docs`, `npm run generate-narrative-docs`, or `npm run generate-docs` should be run.
- Do not regenerate files blindly. Run the smallest relevant generator for the change.

## Commits and Review

- Do not make mid-task commits. Group related finished work into a logical commit.
- Do not add co-author metadata unless explicitly requested.
- Before proposing a commit or claiming the task is done, review the diff and verify the relevant commands were actually run.
- If you use delegated review or sub-agents, verify their output yourself before repeating their conclusions.

## Verification

- Do not claim work is complete without fresh verification evidence from relevant commands.
- Verify the smallest relevant surface first, then broaden as needed.
- Prefer repo-native commands. Typical examples in this repo include `npx nx test <project>`, `npx nx lint <project>`, `npx nx build <project>`, and doc generation commands when context files change.
- If a task affects only one project, verify that project first instead of defaulting to the whole workspace.
- Report what you actually verified, and call out anything you could not run.

## Codex Notes

- In Codex, prefer `workdir` over `cd`.
- Use `apply_patch` for targeted edits.
- Read the repo state before editing, especially in a dirty worktree.
- Do not revert user changes you did not make unless explicitly asked.
