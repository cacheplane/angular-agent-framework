# `@ngaf/chat` License Artifacts (PR A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relicense `@ngaf/chat` from MIT to PolyForm Noncommercial 1.0.0 OR a Threadplane commercial license, by adding five license/policy docs in `libs/chat/`, patching the README to drop "MIT licensed" framing, updating the `package.json` `license` field, and extending `ng-package.json` so the new files end up in the published tarball.

**Architecture:** All changes scoped to `libs/chat/`. No code logic, no other library, no website. The publishable artifact (`dist/libs/chat/`) is the validation surface — after this PR, the tarball must contain the five new docs and the README must no longer claim MIT for `@ngaf/chat`.

**Tech Stack:** ng-packagr (controls which files land in `dist/libs/chat/`), pnpm/npm pack (registry validation), nx build/lint (CI parity).

**Reference:** Spec at `docs/superpowers/specs/2026-05-20-ngaf-chat-license-artifacts-design.md`.

---

## File map

All paths relative to the repo root.

- **Create:** `libs/chat/LICENSE.md` — Threadplane preamble + verbatim PolyForm-NC 1.0.0 body.
- **Create:** `libs/chat/LICENSE-COMMERCIAL.md` — plain-English commercial-license summary.
- **Create:** `libs/chat/COMMERCIAL-USE.md` — definition of commercial use + permitted free uses + 30-day evaluation.
- **Create:** `libs/chat/NOTICE.md` — per-library copyright notice.
- **Create:** `libs/chat/CHANGELOG.md` — first entry: the license change + migration note.
- **Modify:** `libs/chat/README.md` — replace one line + add a "Commercial use" section.
- **Modify:** `libs/chat/package.json` — update `license` field.
- **Modify:** `libs/chat/ng-package.json` — extend `assets` so the new docs ship in the tarball.

No other files in the repo change.

---

## Task 1: Create LICENSE.md with PolyForm-NC body

**Files:**
- Create: `libs/chat/LICENSE.md`

- [ ] **Step 1: Create the file**

Write `libs/chat/LICENSE.md` with this exact content:

```markdown
# @ngaf/chat License

`@ngaf/chat` is licensed under the PolyForm Noncommercial License 1.0.0. Commercial use requires a separate commercial license from Threadplane.

For the definition of commercial use and which free uses are permitted, see [COMMERCIAL-USE.md](./COMMERCIAL-USE.md).
For an overview of the commercial license terms, see [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md).

Versions of `@ngaf/chat` published before this license change remain available under their original MIT terms.

---

## PolyForm Noncommercial License 1.0.0

<https://polyformproject.org/licenses/noncommercial/1.0.0>

## Acceptance

In order to get any license under these terms, you must agree to them as both strict obligations and conditions to all your licenses.

## Copyright License

The licensor grants you a copyright license for the software to do everything you might do with the software that would otherwise infringe the licensor's copyright in it for any permitted purpose. However, you may only distribute the software according to [Distribution License](#distribution-license) and make changes or new works based on the software according to [Changes and New Works License](#changes-and-new-works-license).

## Distribution License

The licensor grants you an additional copyright license to distribute copies of the software. Your license to distribute covers distributing the software with changes and new works permitted by [Changes and New Works License](#changes-and-new-works-license).

## Notices

You must ensure that anyone who gets a copy of any part of the software from you also gets a copy of these terms or the URL for them above, as well as copies of any plain-text lines beginning with `Required Notice:` that the licensor provided with the software. For example:

> Required Notice: Copyright Yoyodyne, Inc. (http://example.com)

## Changes and New Works License

The licensor grants you an additional copyright license to make changes and new works based on the software for any permitted purpose.

## Patent License

The licensor grants you a patent license for the software that covers patent claims the licensor can license, or becomes able to license, that you would infringe by using the software.

## Noncommercial Purposes

Any noncommercial purpose is a permitted purpose.

## Personal Uses

Personal use for research, experiment, and testing for the benefit of public knowledge, personal study, private entertainment, hobby projects, amateur pursuits, or religious observance, without any anticipated commercial application, is use for a permitted purpose.

## Noncommercial Organizations

Use by any charitable organization, educational institution, public research organization, public safety or health organization, environmental protection organization, or government institution is use for a permitted purpose regardless of the source of funding or obligations resulting from the funding.

## Fair Use

You may have "fair use" rights for the software under the law. These terms do not limit them.

## No Other Rights

These terms do not allow you to sublicense or transfer any of your licenses to anyone else, or prevent the licensor from granting licenses to anyone else. These terms do not imply any other licenses.

## Patent Defense

If you make any written claim that the software infringes or contributes to infringement of any patent, your patent license for the software granted under these terms ends immediately. If your company makes such a claim, your patent license ends immediately for work on behalf of your company.

## Violations

The first time you are notified in writing that you have violated any of these terms, or done anything with the software not covered by your licenses, your licenses can nonetheless continue if you come into full compliance with these terms, and take practical steps to correct past violations, within 32 days of receiving notice. Otherwise, all your licenses end immediately.

## No Liability

***As far as the law allows, the software comes as is, without any warranty or condition, and the licensor will not be liable to you for any damages arising out of these terms or the use or nature of the software, under any kind of legal claim.***

## Definitions

The **licensor** is the individual or entity offering these terms, and the **software** is the software the licensor makes available under these terms.

**You** refers to the individual or entity agreeing to these terms.

**Your company** is any legal entity, sole proprietorship, or other kind of organization that you work for, plus all organizations that have control over, are under the control of, or are under common control with that organization. **Control** means ownership of substantially all the assets of an entity, or the power to direct its management and policies by vote, contract, or otherwise. Control can be direct or indirect.

**Your licenses** are all the licenses granted to you for the software under these terms.

**Use** means anything you do with the software requiring one of your licenses.
```

- [ ] **Step 2: Verify the file**

Run: `head -5 libs/chat/LICENSE.md`
Expected: starts with `# @ngaf/chat License`.

Run: `grep -c "PolyForm Noncommercial License 1.0.0" libs/chat/LICENSE.md`
Expected: `2` (preamble + section header).

- [ ] **Step 3: Commit**

```bash
git add libs/chat/LICENSE.md
git commit -m "$(cat <<'EOF'
docs(chat): add LICENSE.md with PolyForm Noncommercial 1.0.0 body

@ngaf/chat is dual-licensed: PolyForm NC 1.0.0 for free noncommercial
use OR a separate Threadplane commercial license. Adds the official
PolyForm NC text alongside a Threadplane preamble that links to the
commercial-summary and commercial-use definition files.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create LICENSE-COMMERCIAL.md (plain-English summary)

**Files:**
- Create: `libs/chat/LICENSE-COMMERCIAL.md`

- [ ] **Step 1: Create the file**

Write `libs/chat/LICENSE-COMMERCIAL.md` with this exact content:

```markdown
# `@ngaf/chat` Commercial License — Summary

Commercial production use of `@ngaf/chat` requires a paid Threadplane commercial license. This document summarizes the expected terms; the signed commercial agreement is authoritative.

## You may

- Use `@ngaf/chat` in commercial production applications.
- Bundle `@ngaf/chat` into hosted SaaS apps, internal tools, and shipped software.
- Modify `@ngaf/chat` for use inside your own application.
- Deploy licensed applications to unlimited end users unless otherwise agreed.
- Use the package in development, staging, CI/CD, and production environments.

## You may not

- Redistribute `@ngaf/chat` as a standalone package.
- Sell, publish, or package it as a competing chat UI library, design system, app builder, template kit, SDK, or component library.
- Remove copyright, attribution, or license notices.
- Bypass license-key or entitlement checks.
- Sublicense the package except as embedded in a larger end-user application.

## How to acquire

See plans and pricing at <https://threadplane.ai/pricing>. For enterprise, procurement, or custom terms, contact us at <https://threadplane.ai/contact>.

See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use and which free uses are permitted.
```

- [ ] **Step 2: Verify the file**

Run: `grep -c "Commercial production use" libs/chat/LICENSE-COMMERCIAL.md`
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/LICENSE-COMMERCIAL.md
git commit -m "$(cat <<'EOF'
docs(chat): add LICENSE-COMMERCIAL.md plain-English summary

Lists what the commercial license grants (production use, SaaS bundling,
modification, CI/CD use, unlimited end users) and what it prohibits
(competing libraries, removing notices, bypassing entitlement checks,
sublicensing as a standalone package). Routes acquisition through
threadplane.ai/pricing and /contact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create COMMERCIAL-USE.md (definitions + evaluation)

**Files:**
- Create: `libs/chat/COMMERCIAL-USE.md`

- [ ] **Step 1: Create the file**

Write `libs/chat/COMMERCIAL-USE.md` with this exact content:

```markdown
# `@ngaf/chat` — Commercial Use Definition

## What counts as commercial use

Commercial use means using `@ngaf/chat` in any application, product, service, internal tool, client deliverable, hosted experience, or workflow that is operated by or for a for-profit entity, generates revenue, supports paid services, supports business operations, or is delivered to a paying client.

## Permitted free use under PolyForm Noncommercial 1.0.0

Free under the PolyForm Noncommercial 1.0.0 license:

- Personal projects
- Hobby projects
- Student projects
- Academic research
- Nonprofit use
- Public demos
- Evaluation and prototyping
- Open-source applications released under an OSI-approved license, provided `@ngaf/chat` is not redistributed as a competing component library

## Evaluation

Commercial evaluation is free for 30 days. Commercial production deployment requires a paid Threadplane license.

## Learn more

For the commercial license summary, see [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md). For the full PolyForm Noncommercial text, see [LICENSE.md](./LICENSE.md). For plans and pricing, see <https://threadplane.ai/pricing>.
```

- [ ] **Step 2: Verify the file**

Run: `grep -c "Commercial use means" libs/chat/COMMERCIAL-USE.md`
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/COMMERCIAL-USE.md
git commit -m "$(cat <<'EOF'
docs(chat): add COMMERCIAL-USE.md defining commercial vs. permitted free use

Defines commercial use (for-profit operation, revenue, paid services,
client deliverables, business workflows), lists permitted free uses
(personal, hobby, student, academic, nonprofit, demos, evaluation,
OSI-licensed open source), and states the 30-day commercial evaluation
window.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create NOTICE.md

**Files:**
- Create: `libs/chat/NOTICE.md`

- [ ] **Step 1: Create the file**

Write `libs/chat/NOTICE.md` with this exact content:

```markdown
# `@ngaf/chat` Notice

Copyright © 2026 Threadplane. All rights reserved.

`@ngaf/chat` is dual-licensed: PolyForm Noncommercial 1.0.0 for free noncommercial use, or a paid Threadplane commercial license. See [LICENSE.md](./LICENSE.md), [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md), and [COMMERCIAL-USE.md](./COMMERCIAL-USE.md).

Built on top of the wider Angular Agent UI ecosystem. The other libraries (`@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/licensing`, `@ngaf/telemetry`, `@ngaf/design-tokens`) remain MIT-licensed.
```

- [ ] **Step 2: Verify the file**

Run: `grep -c "MIT-licensed" libs/chat/NOTICE.md`
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/NOTICE.md
git commit -m "$(cat <<'EOF'
docs(chat): add NOTICE.md with copyright + dual-license attribution

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create CHANGELOG.md with the relicense entry

**Files:**
- Create: `libs/chat/CHANGELOG.md`

- [ ] **Step 1: Create the file**

Write `libs/chat/CHANGELOG.md` with this exact content:

```markdown
# `@ngaf/chat` changelog

## [Unreleased]

### Changed

- **License:** Changed the license for `@ngaf/chat` from MIT to PolyForm Noncommercial 1.0.0 plus commercial licensing. This change applies to future versions only. Historical MIT releases remain under their original license terms.

### Migration

Commercial users upgrading to this version or later need a Threadplane commercial license before production deployment. See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use and the 30-day evaluation window, and <https://threadplane.ai/pricing> for plans.
```

- [ ] **Step 2: Verify the file**

Run: `grep -c "PolyForm Noncommercial 1.0.0 plus commercial licensing" libs/chat/CHANGELOG.md`
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add libs/chat/CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(chat): seed CHANGELOG.md with the relicense entry

First per-library changelog file for @ngaf/chat. Calls out the license
change as the leading entry and includes a migration note for
commercial users.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Patch libs/chat/README.md

**Files:**
- Modify: `libs/chat/README.md`

- [ ] **Step 1: Read the current opener**

Run: `head -10 libs/chat/README.md`

Expected: starts with `# @ngaf/chat`, then a tagline line, then a line that reads exactly `Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework). MIT licensed.`

- [ ] **Step 2: Replace the MIT line and insert the Commercial use section**

Use Edit to change this line in `libs/chat/README.md`:

```
Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework). MIT licensed.
```

…to this multi-paragraph block followed by a new `## Commercial use` section:

```
Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework).

`@ngaf/chat` is source-available and free for noncommercial use under the PolyForm Noncommercial License 1.0.0. Commercial production use requires a Threadplane commercial license.

This package is not licensed as OSI open source because commercial use requires a license. Threadplane uses a source-available model for `@ngaf/chat` while keeping protocol and ecosystem packages permissively licensed where appropriate.

## Commercial use

Building a commercial product, SaaS application, internal business tool, agency deliverable, or paid client project with `@ngaf/chat` requires a commercial license.

Free under PolyForm Noncommercial:

- Personal, hobby, student, academic, nonprofit, public-demo use
- Open-source applications released under an OSI-approved license
- Evaluation and prototyping (commercial evaluation is free for 30 days)

See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use, [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md) for the commercial license summary, and the [Threadplane pricing page](https://threadplane.ai/pricing) for plans.
```

- [ ] **Step 3: Verify**

Run: `grep -c "MIT licensed\." libs/chat/README.md`
Expected: `0`.

Run: `grep -c "PolyForm Noncommercial License 1.0.0" libs/chat/README.md`
Expected: `1`.

Run: `grep -c "## Commercial use" libs/chat/README.md`
Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/README.md
git commit -m "$(cat <<'EOF'
docs(chat): replace MIT framing with source-available + commercial use

The README now leads with PolyForm Noncommercial 1.0.0 + commercial
licensing posture and adds a top-level "Commercial use" section
pointing at COMMERCIAL-USE.md, LICENSE-COMMERCIAL.md, and the
pricing page. Install/usage content below is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update libs/chat/package.json license field

**Files:**
- Modify: `libs/chat/package.json`

- [ ] **Step 1: Try the compound SPDX expression**

Use Edit to change `libs/chat/package.json`:

```json
  "license": "MIT",
```

to:

```json
  "license": "PolyForm-Noncommercial-1.0.0 OR LicenseRef-Threadplane-Commercial",
```

- [ ] **Step 2: Build the lib**

Run from repo root: `npx nx build chat 2>&1 | tail -10`

Expected: `Successfully ran target build for project chat`. The build is what `pnpm pack` will operate on next.

If the build *fails* with a license-related error, fall back to the safe expression:

```json
  "license": "SEE LICENSE IN LICENSE.md",
```

…then re-run `npx nx build chat`. Note in your commit message which path was taken.

- [ ] **Step 3: Pack and inspect for license warnings**

Run from repo root:

```bash
pnpm --filter @ngaf/chat pack --pack-destination /tmp 2>&1 | tail -20
```

(If `pnpm --filter` doesn't resolve the package, fall back to `cd dist/libs/chat && pnpm pack --pack-destination /tmp`.)

Expected: produces a tarball at `/tmp/ngaf-chat-*.tgz` and no `WARN` or `ERR` lines mentioning `license`. If npm/pnpm warns "license should be a valid SPDX license expression," abort the compound and fall back per Step 2.

- [ ] **Step 4: Commit**

If the compound expression worked:

```bash
git add libs/chat/package.json
git commit -m "$(cat <<'EOF'
feat(chat)!: relicense @ngaf/chat — MIT → PolyForm-NC 1.0.0 OR Threadplane-Commercial

BREAKING: package.json license field changes. Future versions of
@ngaf/chat are dual-licensed under PolyForm Noncommercial 1.0.0 OR
a Threadplane commercial license. Historical MIT versions remain
under their original license terms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If the fallback was used, the same commit message applies but append a one-line PS:

```
PS: pnpm pack rejected the compound SPDX expression; using
"SEE LICENSE IN LICENSE.md" per spec fallback. LICENSE.md is
authoritative.
```

---

## Task 8: Extend ng-package.json so the new docs ship in the tarball

**Files:**
- Modify: `libs/chat/ng-package.json`

By default, ng-packagr auto-copies `README.md` but NOT `LICENSE.md`, `LICENSE-COMMERCIAL.md`, `COMMERCIAL-USE.md`, `NOTICE.md`, or `CHANGELOG.md`. Without this task, the published tarball will be missing four of the five new docs and the license claim in `package.json` will reference a `LICENSE.md` that doesn't exist in the published artifact.

- [ ] **Step 1: Read current ng-package.json**

Run: `cat libs/chat/ng-package.json`

Expected:
```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/libs/chat",
  "lib": {
    "entryFile": "src/public-api.ts"
  },
  "allowedNonPeerDependencies": ["@cacheplane/partial-json", "@cacheplane/partial-markdown"],
  "assets": [
    { "input": "src/lib/styles", "glob": "chat.css", "output": "." },
    { "input": "src/themes", "glob": "*.css", "output": "themes" }
  ]
}
```

- [ ] **Step 2: Extend the assets array**

Use Edit to extend the `assets` array so it includes the five docs:

```json
  "assets": [
    { "input": "src/lib/styles", "glob": "chat.css", "output": "." },
    { "input": "src/themes", "glob": "*.css", "output": "themes" },
    { "input": ".", "glob": "LICENSE.md", "output": "." },
    { "input": ".", "glob": "LICENSE-COMMERCIAL.md", "output": "." },
    { "input": ".", "glob": "COMMERCIAL-USE.md", "output": "." },
    { "input": ".", "glob": "NOTICE.md", "output": "." },
    { "input": ".", "glob": "CHANGELOG.md", "output": "." }
  ]
```

- [ ] **Step 3: Rebuild and verify the dist contents**

Run from repo root:

```bash
npx nx build chat 2>&1 | tail -5
ls dist/libs/chat | sort
```

Expected: build succeeds. The `ls` output must include all five new files alongside the pre-existing `README.md`, `package.json`, `fesm2022/`, `debug/`, `testing/`, `themes/`, `types/`.

If any of the five docs is missing from `dist/libs/chat/`, the ng-package.json `assets` entry for that file is wrong — re-check the glob.

- [ ] **Step 4: Pack and confirm the tarball**

Run from repo root:

```bash
cd dist/libs/chat && pnpm pack --pack-destination /tmp && cd - && tar -tzf /tmp/ngaf-chat-*.tgz | grep -E 'LICENSE\.md|LICENSE-COMMERCIAL\.md|COMMERCIAL-USE\.md|NOTICE\.md|CHANGELOG\.md' | sort
```

Expected: exactly 5 lines (the five docs), all under `package/`.

- [ ] **Step 5: Commit**

```bash
git add libs/chat/ng-package.json
git commit -m "$(cat <<'EOF'
build(chat): ship LICENSE.md and policy docs in the published tarball

ng-packagr only auto-copies README.md. Extends the assets array so
LICENSE.md, LICENSE-COMMERCIAL.md, COMMERCIAL-USE.md, NOTICE.md, and
CHANGELOG.md end up in dist/libs/chat and therefore in the published
npm tarball. Without this, package.json's license claim would point at
a LICENSE.md that doesn't exist in the published artifact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run from repo root: `npx nx run chat:lint 2>&1 | tail -5`
Expected: `Successfully ran target lint for project chat`. No new warnings on touched files.

- [ ] **Step 2: Tests still pass**

Run from repo root: `npx nx run chat:test 2>&1 | tail -5`
Expected: `Successfully ran target test for project chat`. (Pre-existing pass count; no test files were touched in this PR.)

- [ ] **Step 3: Confirm acceptance criteria**

```bash
# 1. package.json license field is set
grep '"license"' libs/chat/package.json

# 2. LICENSE.md, LICENSE-COMMERCIAL.md, COMMERCIAL-USE.md, NOTICE.md, CHANGELOG.md all exist
ls libs/chat/LICENSE.md libs/chat/LICENSE-COMMERCIAL.md libs/chat/COMMERCIAL-USE.md libs/chat/NOTICE.md libs/chat/CHANGELOG.md

# 3. README no longer claims MIT for @ngaf/chat
! grep -q "MIT licensed\." libs/chat/README.md && echo "README MIT claim removed"

# 4. README contains the new framing
grep -c "PolyForm Noncommercial License 1.0.0" libs/chat/README.md   # expect 1
grep -c "## Commercial use" libs/chat/README.md                      # expect 1

# 5. No other library or website file modified
git diff --stat origin/main..HEAD -- 'libs/*' | grep -v 'libs/chat/' && echo "FAIL: outside libs/chat/" || echo "OK: scope limited to libs/chat/"
git diff --stat origin/main..HEAD -- 'apps/' | head -1 && echo "FAIL: apps/ touched" || echo "OK: no apps/ change"
```

All checks should pass / report `OK`.

- [ ] **Step 4: Final tarball check**

```bash
ls /tmp/ngaf-chat-*.tgz && tar -tzf /tmp/ngaf-chat-*.tgz | grep -E 'LICENSE\.md|LICENSE-COMMERCIAL\.md|COMMERCIAL-USE\.md|NOTICE\.md|CHANGELOG\.md|README\.md|package\.json' | sort
```

Expected: 7 paths inside the tarball (`package/CHANGELOG.md`, `package/COMMERCIAL-USE.md`, `package/LICENSE-COMMERCIAL.md`, `package/LICENSE.md`, `package/NOTICE.md`, `package/README.md`, `package/package.json`).

---

## Self-review

**Spec coverage:**
- Detailed content § `LICENSE.md` → Task 1. ✓
- Detailed content § `LICENSE-COMMERCIAL.md` → Task 2. ✓
- Detailed content § `COMMERCIAL-USE.md` → Task 3. ✓
- Detailed content § `NOTICE.md` → Task 4. ✓
- Detailed content § `CHANGELOG.md` → Task 5. ✓
- Detailed content § README targeted patch → Task 6. ✓
- Detailed content § `package.json` license field (with fallback path) → Task 7. ✓
- Spec acceptance criterion 7 (tarball contains the five new docs) → Task 8 + Task 9 Step 4. ✓
- Spec verification commands (`npx nx build chat`, `npx nx run chat:lint`, `pnpm pack`) → Tasks 7, 8, 9. ✓
- Out-of-scope (no other library / no apps / no runtime code) → enforced via Task 9 Step 3 scope check. ✓

**Placeholder scan:** Every code block / file body is fully written; no `TBD`, no "see spec." The only conditional path is the package.json license-field fallback, which is fully documented inline.

**Type consistency:** No types involved (docs-only PR). Filenames and links are consistent across files: every cross-reference uses the same `./LICENSE.md`, `./LICENSE-COMMERCIAL.md`, `./COMMERCIAL-USE.md` casing. Threadplane URL `https://threadplane.ai/pricing` and `/contact` used consistently.

Plan complete.
