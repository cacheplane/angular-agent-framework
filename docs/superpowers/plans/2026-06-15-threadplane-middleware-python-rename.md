# threadplane-middleware (Python clean-cut rename) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the published Python middleware `threadplane-client-tools` → `threadplane-middleware` with a vendor-first module path `threadplane.middleware.langgraph`, migrating all in-repo consumers, with zero backwards-compat shim and zero deploy breakage.

**Architecture:** Plan A of the two-plan split from the spec (Plan B is the JS package). The middleware *logic is unchanged* — this is a package/module rename plus consumer migration. Safe sequencing is the crux: the deploy drift guard runs ONLY in the deploy workflows (triggered by changes under `deployments/**` or the generator scripts), never in PR CI. So **PR1** migrates the package + consumer code/pyproject via a `[tool.uv.sources]` path dependency (what `uv run`/pytest/smoke consume) but deliberately leaves every consumer `requirements.txt` and all of `deployments/**` untouched — deploys keep resolving the still-published, code-identical `threadplane-client-tools==0.0.1`, and no deploy workflow fires. After the maintainer publishes `threadplane-middleware 0.0.1` to PyPI, **PR2** flips pyproject path→published and regenerates `requirements.txt` + `deployments/**`, moving deploys onto the new package.

**Tech Stack:** Python 3.10+, hatchling, uv, LangGraph/LangChain (peer of consumers), PyPI trusted publishing, Nx (smoke targets), GitHub Actions.

---

## Spec

`docs/superpowers/specs/2026-06-15-threadplane-middleware-langgraph-js-design.md` — sections "Python clean-cut rename", "Naming & home decisions", "Repository layout".

## File map

**Renamed package (`packages/threadplane-client-tools/` → `packages/threadplane-middleware/`):**
- `pyproject.toml` — `name = "threadplane-middleware"`; wheel `packages = ["src/threadplane"]` unchanged (still captures the whole namespace tree).
- `src/threadplane/client_tools/__init__.py` → `src/threadplane/middleware/langgraph/__init__.py` — re-exports unchanged; intermediate `threadplane/` and `threadplane/middleware/` dirs stay `__init__`-free (PEP 420).
- `src/threadplane/client_tools/middleware.py` → `src/threadplane/middleware/langgraph/middleware.py` — content byte-identical (no internal package imports).
- `tests/test_middleware.py` — import path updated.
- `README.md` — name + import strings updated.

**Consumers (code + pyproject + lock only; NOT requirements.txt):**
- `examples/ag-ui/python/{src/graph.py,pyproject.toml,uv.lock}`
- `cockpit/ag-ui/client-tools/python/{src/graph.py,pyproject.toml,uv.lock}`
- `cockpit/langgraph/client-tools/python/{src/graph.py,pyproject.toml,uv.lock}`

**Workflow:** `.github/workflows/publish-client-tools-python.yml` → `publish-middleware-python.yml`.

**Docs:** `cockpit/ag-ui/client-tools/python/docs/guide.md`, `cockpit/langgraph/client-tools/python/docs/guide.md`, `packages/threadplane/README.md`.

**Deferred to PR2 (post-publish):** all consumer `requirements.txt`, `deployments/ag-ui-dev/**`, `deployments/shared-dev/**`.

---

## Task 0: Branch

- [ ] **Step 1: Create the PR1 branch from latest main**

```bash
cd /Users/blove/repos/angular-agent-framework/.claude/worktrees/quirky-haslett-d443a4
git fetch origin
git checkout -b claude/py-middleware-rename origin/main
```

---

## Task 1: Rename the package directory + manifest

**Files:**
- Move: `packages/threadplane-client-tools/` → `packages/threadplane-middleware/`
- Modify: `packages/threadplane-middleware/pyproject.toml`
- Modify: `packages/threadplane-middleware/README.md`

- [ ] **Step 1: git mv the package directory**

```bash
git mv packages/threadplane-client-tools packages/threadplane-middleware
```

- [ ] **Step 2: Rename the distribution in pyproject.toml**

In `packages/threadplane-middleware/pyproject.toml`, change only the `name` line under `[project]`:

```toml
name = "threadplane-middleware"
```

Leave `version = "0.0.1"`, `dependencies`, and `[tool.hatch.build.targets.wheel] packages = ["src/threadplane"]` unchanged — the wheel path already captures the whole `threadplane` namespace tree, so it stays correct after the module move in Task 2.

- [ ] **Step 3: Update the package README**

In `packages/threadplane-middleware/README.md`:
- Line 1 heading: `# threadplane-middleware`
- `pip install threadplane-client-tools` → `pip install threadplane-middleware`
- both `from threadplane.client_tools import …` snippets → `from threadplane.middleware.langgraph import …`

- [ ] **Step 4: Commit**

```bash
git add packages/threadplane-middleware
git commit -m "refactor(py): rename package dir threadplane-client-tools -> threadplane-middleware"
```

---

## Task 2: Move the source module to the vendor-first namespace path

**Files:**
- Move: `src/threadplane/client_tools/` → `src/threadplane/middleware/langgraph/` (within `packages/threadplane-middleware/`)
- Modify: `packages/threadplane-middleware/src/threadplane/middleware/langgraph/__init__.py`
- Modify: `packages/threadplane-middleware/tests/test_middleware.py`

- [ ] **Step 1: Create the new namespace path and move the module**

```bash
cd packages/threadplane-middleware
mkdir -p src/threadplane/middleware
git mv src/threadplane/client_tools src/threadplane/middleware/langgraph
cd ../..
```

Confirm there is NO `__init__.py` directly under `src/threadplane/` or `src/threadplane/middleware/` (PEP 420 namespace packages — only the `langgraph` leaf has one):

```bash
ls packages/threadplane-middleware/src/threadplane/__init__.py 2>/dev/null && echo "REMOVE THIS" || echo "ok: no threadplane/__init__.py"
ls packages/threadplane-middleware/src/threadplane/middleware/__init__.py 2>/dev/null && echo "REMOVE THIS" || echo "ok: no middleware/__init__.py"
```

If either prints "REMOVE THIS", delete it: `git rm packages/threadplane-middleware/src/threadplane/__init__.py` (and/or the `middleware/__init__.py`).

- [ ] **Step 2: Update the leaf __init__.py import + docstring**

In `packages/threadplane-middleware/src/threadplane/middleware/langgraph/__init__.py`, change the docstring and the internal import; the `__all__` list is unchanged:

```python
# SPDX-License-Identifier: MIT
"""threadplane-middleware — LangGraph middleware for client-declared tools."""

from threadplane.middleware.langgraph.middleware import (
    bind_client_tools,
    client_tool_names,
    client_tool_specs,
    has_client_tool_call,
    has_server_tool_call,
    last_message,
    route_after_agent,
)

__all__ = [
    "bind_client_tools",
    "client_tool_names",
    "client_tool_specs",
    "has_client_tool_call",
    "has_server_tool_call",
    "last_message",
    "route_after_agent",
]
```

(`middleware.py` itself has no internal package imports — leave it byte-identical.)

- [ ] **Step 3: Update the test import**

In `packages/threadplane-middleware/tests/test_middleware.py`, line 2 docstring and line 5 import:

```python
"""Tests for threadplane.middleware.langgraph.middleware — no LangChain import required."""
import pytest

from threadplane.middleware.langgraph.middleware import (
```

(Leave the imported symbol list and all test bodies unchanged.)

- [ ] **Step 4: Run the package tests — verify green at the new path**

Run:
```bash
cd packages/threadplane-middleware
uv venv
uv pip install -e '.[test]'
uv run pytest -q
cd ../..
```
Expected: all tests PASS (same count as before the move).

- [ ] **Step 5: Build the wheel — verify the namespace tree packages correctly**

Run:
```bash
cd packages/threadplane-middleware && uv build && cd ../..
```
Expected: builds `dist/threadplane_middleware-0.0.1-*.whl` with no error. Confirm the module path is inside:
```bash
unzip -l packages/threadplane-middleware/dist/threadplane_middleware-0.0.1-*.whl | grep "threadplane/middleware/langgraph/middleware.py"
```
Expected: one matching line.

- [ ] **Step 6: Commit**

```bash
git add packages/threadplane-middleware
git commit -m "refactor(py): move module to threadplane.middleware.langgraph namespace"
```

---

## Task 3: Migrate consumer — cockpit/ag-ui/client-tools/python

**Files:**
- Modify: `cockpit/ag-ui/client-tools/python/src/graph.py:20`
- Modify: `cockpit/ag-ui/client-tools/python/pyproject.toml`
- Modify: `cockpit/ag-ui/client-tools/python/uv.lock` (regenerated)

- [ ] **Step 1: Update the import in graph.py**

`cockpit/ag-ui/client-tools/python/src/graph.py` line 20:

```python
from threadplane.middleware.langgraph import bind_client_tools
```

- [ ] **Step 2: Update the dependency + add a path source in pyproject.toml**

In `cockpit/ag-ui/client-tools/python/pyproject.toml`, change the dependency line:

```toml
    "threadplane-middleware>=0.0.1",
```

This consumer has no `[tool.uv]` table; append a new one at the end of the file:

```toml
[tool.uv.sources]
threadplane-middleware = { path = "../../../../packages/threadplane-middleware", editable = true }
```

(Path is relative to `cockpit/ag-ui/client-tools/python/` — four levels up to the repo root.)

- [ ] **Step 3: Regenerate the lock**

Run:
```bash
cd cockpit/ag-ui/client-tools/python && uv lock && cd -
```
Expected: `uv.lock` updated; `grep threadplane uv.lock` shows `threadplane-middleware` sourced from the editable path, and no `threadplane-client-tools` entry remains.

- [ ] **Step 4: Verify the smoke target — import resolves and graph builds**

Run:
```bash
npx nx run cockpit-ag-ui-client-tools-python:smoke
```
Expected: exit 0 (the smoke imports `graph` and exercises the build).

- [ ] **Step 5: Commit**

```bash
git add cockpit/ag-ui/client-tools/python/src/graph.py cockpit/ag-ui/client-tools/python/pyproject.toml cockpit/ag-ui/client-tools/python/uv.lock
git commit -m "refactor(cockpit): ag-ui client-tools python imports threadplane.middleware.langgraph"
```

---

## Task 4: Migrate consumer — cockpit/langgraph/client-tools/python

**Files:**
- Modify: `cockpit/langgraph/client-tools/python/src/graph.py:19`
- Modify: `cockpit/langgraph/client-tools/python/pyproject.toml`
- Modify: `cockpit/langgraph/client-tools/python/uv.lock` (regenerated)

- [ ] **Step 1: Update the import in graph.py**

`cockpit/langgraph/client-tools/python/src/graph.py` line 19:

```python
from threadplane.middleware.langgraph import bind_client_tools
```

- [ ] **Step 2: Update the dependency + add a path source in pyproject.toml**

Change the dependency line:

```toml
    "threadplane-middleware>=0.0.1",
```

This consumer already has a `[tool.uv]` table (with `dev-dependencies`). Add a SEPARATE `[tool.uv.sources]` table (do not nest it under `[tool.uv]` — place it as its own table, e.g. directly after the `[tool.uv]` block):

```toml
[tool.uv.sources]
threadplane-middleware = { path = "../../../../packages/threadplane-middleware", editable = true }
```

- [ ] **Step 3: Regenerate the lock**

Run:
```bash
cd cockpit/langgraph/client-tools/python && uv lock && cd -
```
Expected: `threadplane-middleware` via editable path in `uv.lock`; no `threadplane-client-tools`.

- [ ] **Step 4: Verify the smoke target**

Run:
```bash
npx nx run cockpit-langgraph-client-tools-python:smoke
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add cockpit/langgraph/client-tools/python/src/graph.py cockpit/langgraph/client-tools/python/pyproject.toml cockpit/langgraph/client-tools/python/uv.lock
git commit -m "refactor(cockpit): langgraph client-tools python imports threadplane.middleware.langgraph"
```

---

## Task 5: Migrate consumer — examples/ag-ui/python

**Files:**
- Modify: `examples/ag-ui/python/src/graph.py:45`
- Modify: `examples/ag-ui/python/pyproject.toml`
- Modify: `examples/ag-ui/python/uv.lock` (regenerated)

- [ ] **Step 1: Update the import in graph.py**

`examples/ag-ui/python/src/graph.py` line 45 (note: this consumer imports two symbols):

```python
from threadplane.middleware.langgraph import bind_client_tools, client_tool_names
```

- [ ] **Step 2: Update the dependency + add a path source in pyproject.toml**

Change the dependency line:

```toml
    "threadplane-middleware>=0.0.1",
```

This consumer has a `[tool.uv]` table (`dev-dependencies`). Add a separate `[tool.uv.sources]` table — note this path is only THREE levels up (`examples/ag-ui/python/`):

```toml
[tool.uv.sources]
threadplane-middleware = { path = "../../../packages/threadplane-middleware", editable = true }
```

- [ ] **Step 3: Regenerate the lock**

Run:
```bash
cd examples/ag-ui/python && uv lock && cd -
```
Expected: `threadplane-middleware` via editable path; no `threadplane-client-tools`.

- [ ] **Step 4: Verify the import resolves**

Run:
```bash
cd examples/ag-ui/python && uv run python -c "from threadplane.middleware.langgraph import bind_client_tools, client_tool_names; print('ok')" && cd -
```
Expected: prints `ok`.

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/python/src/graph.py examples/ag-ui/python/pyproject.toml examples/ag-ui/python/uv.lock
git commit -m "refactor(examples): ag-ui python imports threadplane.middleware.langgraph"
```

---

## Task 6: Rename the publish workflow

**Files:**
- Move: `.github/workflows/publish-client-tools-python.yml` → `.github/workflows/publish-middleware-python.yml`

- [ ] **Step 1: git mv the workflow**

```bash
git mv .github/workflows/publish-client-tools-python.yml .github/workflows/publish-middleware-python.yml
```

- [ ] **Step 2: Update the workflow contents**

In `.github/workflows/publish-middleware-python.yml`, replace every `threadplane-client-tools` occurrence with `threadplane-middleware`. The substantive edits:
- header comment package name and the PyPI Trusted-Publisher setup note (project name + `Workflow: publish-middleware-python.yml`)
- `name: Publish threadplane-middleware (Python)`
- `concurrency.group: publish-middleware-python`
- the job `name:` line
- all three `working-directory: packages/threadplane-client-tools` → `working-directory: packages/threadplane-middleware`

- [ ] **Step 3: Verify no stale references remain in the workflow**

Run:
```bash
grep -n "threadplane-client-tools\|publish-client-tools" .github/workflows/publish-middleware-python.yml || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/publish-middleware-python.yml
git commit -m "ci(py): rename publish workflow to publish-middleware-python"
```

---

## Task 7: Update docs

**Files:**
- Modify: `cockpit/ag-ui/client-tools/python/docs/guide.md`
- Modify: `cockpit/langgraph/client-tools/python/docs/guide.md`
- Modify: `packages/threadplane/README.md`

- [ ] **Step 1: Fix the ag-ui guide import references**

In `cockpit/ag-ui/client-tools/python/docs/guide.md`, replace every `threadplane_client_tools` AND any `threadplane.client_tools` with `threadplane.middleware.langgraph` (the Python `import`/`from` module path). The `pip install` / distribution-name references become `threadplane-middleware`. Known sites: the `<Prompt>` block (~line 21), the backend `<Step>` prose (~line 133), and the code snippet (~line 145: `from threadplane.middleware.langgraph import bind_client_tools`).

- [ ] **Step 2: Fix the langgraph guide references**

In `cockpit/langgraph/client-tools/python/docs/guide.md`, apply the same replacements (module path → `threadplane.middleware.langgraph`, distribution → `threadplane-middleware`).

- [ ] **Step 3: Update the threadplane namespace-root README**

In `packages/threadplane/README.md`:
- the bullet `- \`threadplane-client-tools\` — importable as \`threadplane.client_tools\`` → `- \`threadplane-middleware\` — importable as \`threadplane.middleware.langgraph\``
- `pip install threadplane-client-tools` → `pip install threadplane-middleware`

- [ ] **Step 4: Commit**

```bash
git add cockpit/ag-ui/client-tools/python/docs/guide.md cockpit/langgraph/client-tools/python/docs/guide.md packages/threadplane/README.md
git commit -m "docs(py): point client-tools guides + threadplane README at threadplane.middleware.langgraph"
```

---

## Task 8: Repo-wide grep gate + final verification + PR1

- [ ] **Step 1: Grep gate — no stale references outside venvs / dated docs**

Run:
```bash
grep -rln "threadplane.client_tools\|threadplane_client_tools\|threadplane-client-tools" \
  --include="*.py" --include="*.toml" --include="*.md" --include="*.yml" --include="*.txt" . \
  | grep -v "/.venv/" | grep -v "node_modules"
```
Expected matches and how to treat each:
- `deployments/ag-ui-dev/**`, `deployments/shared-dev/**`, and the three consumer `requirements.txt` files — **EXPECTED to still say `threadplane-client-tools==0.0.1`** (intentionally deferred to PR2; do NOT change them here).
- `docs/superpowers/plans/2026-06-11-*.md` and `docs/superpowers/specs/*` — historical dated records; leave as-is.
- Any OTHER file (source, active docs, workflow) — a miss; fix it and amend the relevant task's commit.

- [ ] **Step 2: Re-run all three smoke/import checks together**

Run:
```bash
npx nx run cockpit-ag-ui-client-tools-python:smoke
npx nx run cockpit-langgraph-client-tools-python:smoke
(cd examples/ag-ui/python && uv run python -c "from threadplane.middleware.langgraph import bind_client_tools, client_tool_names; print('ok')")
```
Expected: two smoke exits 0, one `ok`.

- [ ] **Step 3: Confirm deployments/ and consumer requirements.txt are untouched**

Run:
```bash
git diff --name-only origin/main...HEAD | grep -E "deployments/|requirements.txt" || echo "clean: no deploy/requirements changes in PR1"
```
Expected: `clean: no deploy/requirements changes in PR1`.

- [ ] **Step 4: Push and open PR1**

```bash
git push -u origin claude/py-middleware-rename
gh pr create --base main --head claude/py-middleware-rename \
  --title "refactor(py): rename threadplane-client-tools -> threadplane-middleware (.middleware.langgraph)" \
  --body "Plan A of the middleware spec. Clean-cut rename (no backwards-compat shim). Package dir + module path (\`threadplane.middleware.langgraph\`) + 3 consumers migrated via a transitional \`[tool.uv.sources]\` path dependency + publish workflow renamed + docs.

Deploys are intentionally untouched: every consumer \`requirements.txt\` and all of \`deployments/**\` still pin the still-published, code-identical \`threadplane-client-tools==0.0.1\`, and no deploy workflow fires (the drift guard only runs under \`deployments/**\` / generator changes). After \`threadplane-middleware 0.0.1\` is published to PyPI, PR2 flips pyproject path->published and regenerates requirements + deploy configs.

Verified: package pytest green at new path; wheel packages the namespace tree; all three consumers' smoke/import checks green; repo-wide grep clean except the deferred deploy/requirements pins.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr merge --squash --auto claude/py-middleware-rename
```

---

## PR2 (post-publish — gated on the maintainer's PyPI publish; do NOT start until `threadplane-middleware 0.0.1` is live)

Between PR1 merge and the publish, deploys keep working on `threadplane-client-tools==0.0.1`. After the maintainer dispatches `publish-middleware-python.yml` (dry-run, then real) and `threadplane-middleware 0.0.1` exists on PyPI:

### Task 9: Flip consumers path→published + regenerate deploys

**Files:**
- Modify (×3 consumers): remove `[tool.uv.sources]` block; regenerate `uv.lock` + `requirements.txt`
- Regenerate: `deployments/ag-ui-dev/**`, `deployments/shared-dev/**`

- [ ] **Step 1: Branch**

```bash
git fetch origin && git checkout -b claude/py-middleware-publish-flip origin/main
```

- [ ] **Step 2: Remove the path source from all three consumers**

Delete the `[tool.uv.sources]` table (the `threadplane-middleware = { path = … }` block) from each of:
`examples/ag-ui/python/pyproject.toml`, `cockpit/ag-ui/client-tools/python/pyproject.toml`, `cockpit/langgraph/client-tools/python/pyproject.toml`. Leave the `threadplane-middleware>=0.0.1` dependency line.

- [ ] **Step 3: Regenerate locks + exported requirements for each consumer**

For each of the three consumer dirs run:
```bash
cd <consumer-dir>
uv lock
uv export --no-hashes --no-emit-project -o requirements.txt   # match the existing export convention; see the file's header comment for exact flags
cd -
```
Expected: `requirements.txt` now pins `threadplane-middleware==0.0.1` (PyPI), no path/file ref, no `threadplane-client-tools`.

> If `uv export` flags differ from the committed files' header, copy the exact flags from the top-of-file comment in the current `requirements.txt` so the diff stays minimal.

- [ ] **Step 4: Regenerate both deploy configs**

```bash
npx tsx scripts/generate-ag-ui-deployment-config.ts
npx tsx scripts/generate-shared-deployment-config.ts
```
Expected: `deployments/ag-ui-dev/**` and `deployments/shared-dev/**` regenerate; the vendored `requirements.txt` in each now pins `threadplane-middleware==0.0.1`.

- [ ] **Step 5: Grep gate — zero `threadplane-client-tools` left anywhere active**

```bash
grep -rln "threadplane-client-tools\|threadplane_client_tools\|threadplane.client_tools" \
  --include="*.py" --include="*.toml" --include="*.md" --include="*.yml" --include="*.txt" . \
  | grep -v "/.venv/" | grep -v "node_modules" | grep -v "docs/superpowers/"
```
Expected: no output (only dated `docs/superpowers/` historical records may still reference the old name).

- [ ] **Step 6: Verify smokes + deploy drift guards locally**

```bash
npx nx run cockpit-ag-ui-client-tools-python:smoke
npx nx run cockpit-langgraph-client-tools-python:smoke
git diff --exit-code -- deployments/ag-ui-dev/ && echo "ag-ui deploy in sync"
git diff --exit-code -- deployments/shared-dev/ && echo "shared deploy in sync"
```
(The last two should show no diff AFTER you've committed the regenerated configs — run them post-commit to mirror the CI guard, which compares a fresh regen against the committed tree.)

- [ ] **Step 7: Commit, push, PR2**

```bash
git add examples/ag-ui/python cockpit/ag-ui/client-tools/python cockpit/langgraph/client-tools/python deployments/
git commit -m "refactor(py): consume published threadplane-middleware; regenerate deploys"
git push -u origin claude/py-middleware-publish-flip
gh pr create --base main --head claude/py-middleware-publish-flip \
  --title "refactor(py): flip consumers to published threadplane-middleware + regenerate deploys" \
  --body "PR2 of the middleware rename. Removes the transitional path sources, regenerates consumer requirements + both deploy configs to pin threadplane-middleware==0.0.1. Triggers the deploy workflows on merge (drift guards verified locally).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Watch the deploy-ag-ui and deploy-langgraph workflows on merge; confirm both deploys come up on the new package.

---

## Self-review notes

- **Spec coverage:** package rename (Tasks 1–2), module path `threadplane.middleware.langgraph` (Task 2), 3 consumers (Tasks 3–5), workflow rename (Task 6), docs incl. both guides + threadplane README (Task 7), clean cut / no shim (no shim task exists — intentional), deferred deploy/publish sequence (PR2 / Task 9). The dormant `threadplane-client-tools` needs no action (left published).
- **No placeholders:** every edit names exact files/lines and shows the literal replacement. The one soft spot is the `uv export` flag set in PR2 Step 3 — mitigated by instructing to copy the exact flags from the committed file's header comment (the convention already in-repo) rather than inventing them.
- **Naming consistency:** module path `threadplane.middleware.langgraph`, distribution `threadplane-middleware`, npm sibling `@threadplane/middleware/langgraph` (Plan B) — consistent throughout.
