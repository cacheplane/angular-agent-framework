# PR A — `@ngaf/chat` License Artifacts & Metadata

**Status:** Design approved, ready for implementation plan.
**Owner:** libs/chat
**Affects:** `libs/chat/` package files only. No other library, no website surfaces (those land in PR B), no runtime enforcement code (that lands in PR C).

## Goal

Relicense the `@ngaf/chat` library from MIT to a dual model: **PolyForm Noncommercial 1.0.0** (free for noncommercial use) **OR** a separate Threadplane commercial license. Bundle the license text into the package and update the package metadata + README so consumers see the new posture from the next published version.

Historical npm versions remain MIT. The change applies to future versions only.

## Out of scope

- All other libraries (`@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/licensing`, `@ngaf/telemetry`, `@ngaf/design-tokens`) stay MIT. Their `package.json`, README, and license files are unchanged.
- Root `README.md`, root `COMMERCIAL.md`, root `LICENSE`, root `NOTICE`. Those are part of the public posture sweep in PR B.
- Pricing page, homepage hero, footer, FAQ, docs MDX. PR B.
- Runtime enforcement, public-key distribution, nag UI, claims schema. PR C.

## Files in this PR

All paths relative to repo root.

| Action | Path | Purpose |
|---|---|---|
| Modify | `libs/chat/package.json` | Update `license` field |
| Create | `libs/chat/LICENSE.md` | PolyForm NC 1.0.0 text + Threadplane preamble |
| Create | `libs/chat/LICENSE-COMMERCIAL.md` | Plain-English summary of the commercial license |
| Create | `libs/chat/COMMERCIAL-USE.md` | Definition of commercial vs. permitted free use + evaluation note |
| Create | `libs/chat/NOTICE.md` | Per-library copyright/attribution notice |
| Modify | `libs/chat/README.md` | Targeted patch — replace MIT line, add Commercial use section |
| Create | `libs/chat/CHANGELOG.md` | First entry: the license change |

No code logic changes. No website file changes. No infrastructure changes.

## Detailed content

### `libs/chat/package.json` — license field

Attempt the SPDX compound expression:

```json
{
  "license": "PolyForm-Noncommercial-1.0.0 OR LicenseRef-Threadplane-Commercial"
}
```

Verify by running `npm pack` (or `pnpm pack`) locally on `libs/chat/dist` and confirming no `npm WARN` or error mentions the `license` field. If the registry/tooling rejects it, fall back to:

```json
{
  "license": "SEE LICENSE IN LICENSE.md"
}
```

Either way, the LICENSE.md file is the authoritative source of terms.

### `libs/chat/LICENSE.md`

Structure:

1. One-paragraph Threadplane preamble naming the dual model and pointing at LICENSE-COMMERCIAL.md and COMMERCIAL-USE.md for the commercial path.
2. Horizontal rule.
3. Full unmodified text of **PolyForm Noncommercial License 1.0.0** from polyformproject.org/licenses/noncommercial/1.0.0/. No edits to the official body.

Preamble text (verbatim, per user's prompt):

> `@ngaf/chat` is licensed under the PolyForm Noncommercial License 1.0.0. Commercial use requires a separate commercial license from Threadplane.
>
> For the definition of commercial use and which free uses are permitted, see [COMMERCIAL-USE.md](./COMMERCIAL-USE.md).
> For an overview of the commercial license terms, see [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md).
>
> Versions of `@ngaf/chat` published before this license change remain available under their original MIT terms.

### `libs/chat/LICENSE-COMMERCIAL.md`

Plain-English summary. Headline: "Commercial license summary". Then sections:

- **Lead:** "Commercial production use of `@ngaf/chat` requires a paid Threadplane commercial license. This document summarizes the expected terms; the signed commercial agreement is authoritative."
- **You may** (heading + bulleted list, verbatim from the user's spec):
  - Use `@ngaf/chat` in commercial production applications.
  - Bundle `@ngaf/chat` into hosted SaaS apps, internal tools, and shipped software.
  - Modify `@ngaf/chat` for use inside your own application.
  - Deploy licensed applications to unlimited end users unless otherwise agreed.
  - Use the package in development, staging, CI/CD, and production environments.
- **You may not** (heading + bulleted list, verbatim):
  - Redistribute `@ngaf/chat` as a standalone package.
  - Sell, publish, or package it as a competing chat UI library, design system, app builder, template kit, SDK, or component library.
  - Remove copyright, attribution, or license notices.
  - Bypass license-key or entitlement checks.
  - Sublicense the package except as embedded in a larger end-user application.
- **How to acquire:** one line pointing at https://threadplane.ai/pricing and https://threadplane.ai/contact for sales.

### `libs/chat/COMMERCIAL-USE.md`

Structure:

- **What counts as commercial use** — verbatim from user's prompt:
  > Commercial use means using `@ngaf/chat` in any application, product, service, internal tool, client deliverable, hosted experience, or workflow that is operated by or for a for-profit entity, generates revenue, supports paid services, supports business operations, or is delivered to a paying client.
- **Permitted free use under PolyForm Noncommercial 1.0.0** — verbatim bulleted list:
  - Personal projects
  - Hobby projects
  - Student projects
  - Academic research
  - Nonprofit use
  - Public demos
  - Evaluation and prototyping
  - Open-source applications released under an OSI-approved license, provided `@ngaf/chat` is not redistributed as a competing component library
- **Evaluation:** verbatim:
  > Commercial evaluation is free for 30 days. Commercial production deployment requires a paid Threadplane license.
- **Where to learn more / acquire** — one line pointing back at LICENSE-COMMERCIAL.md and the pricing page.

### `libs/chat/NOTICE.md`

Short. Three lines:

> Copyright © 2026 Threadplane. All rights reserved.
>
> `@ngaf/chat` is dual-licensed: PolyForm Noncommercial 1.0.0 for free noncommercial use, or a paid Threadplane commercial license. See [LICENSE.md](./LICENSE.md), [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md), and [COMMERCIAL-USE.md](./COMMERCIAL-USE.md).
>
> Built on top of the wider Angular Agent UI ecosystem, the other libraries of which remain MIT-licensed.

### `libs/chat/README.md` — targeted patch

Current README opens with: `Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework). MIT licensed.`

Replace that single line and append a new section just above the install instructions.

**Replacement opener (replaces the `MIT licensed` line):**

> `@ngaf/chat` is source-available and free for noncommercial use under the PolyForm Noncommercial License 1.0.0. Commercial production use requires a Threadplane commercial license.
>
> This package is not licensed as OSI open source because commercial use requires a license. Threadplane uses a source-available model for `@ngaf/chat` while keeping protocol and ecosystem packages permissively licensed where appropriate.

**New "Commercial use" section** (insert at the top, right after the opener and before any install/usage content):

```markdown
## Commercial use

Building a commercial product, SaaS application, internal business tool, agency deliverable, or paid client project with `@ngaf/chat` requires a commercial license.

Free under PolyForm Noncommercial:
- Personal, hobby, student, academic, nonprofit, public-demo use
- Open-source applications released under an OSI-approved license
- Evaluation and prototyping (up to 30 days for commercial evaluation)

See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md) for the definition of commercial use, [LICENSE-COMMERCIAL.md](./LICENSE-COMMERCIAL.md) for the commercial license summary, and the Threadplane pricing page for plans.
```

No other content in `libs/chat/README.md` changes.

### `libs/chat/CHANGELOG.md`

First entry. Use whatever the latest published `@ngaf/chat` version is (look up via `pnpm view @ngaf/chat version` during implementation; today the memory says we're at 0.0.x). Per the project's "patch-only" rule from memory, this is **not** a 0.1.0 bump — it's the next 0.0.x patch.

```markdown
# @ngaf/chat changelog

## [Unreleased]

### Changed

- **License:** Changed the license for `@ngaf/chat` from MIT to PolyForm Noncommercial 1.0.0 plus commercial licensing. This change applies to future versions only. Historical MIT releases remain under their original license terms.

### Migration

- Commercial users upgrading to this version or later need a Threadplane commercial license before production deployment. See [COMMERCIAL-USE.md](./COMMERCIAL-USE.md).
```

The `[Unreleased]` heading flips to a version stamp when the release is cut (handled by whatever publish script the project already uses; out of scope here).

## Acceptance criteria

1. `libs/chat/package.json` `license` field is either the compound SPDX expression or `"SEE LICENSE IN LICENSE.md"` (whichever is accepted by `pnpm pack` / `npm pack` without warning).
2. `libs/chat/LICENSE.md` exists, opens with the Threadplane preamble, and contains the full unmodified PolyForm Noncommercial 1.0.0 text.
3. `libs/chat/LICENSE-COMMERCIAL.md`, `libs/chat/COMMERCIAL-USE.md`, `libs/chat/NOTICE.md`, and `libs/chat/CHANGELOG.md` exist with content per "Detailed content" above.
4. `libs/chat/README.md` no longer claims MIT for `@ngaf/chat`. It opens with the source-available framing and has a top-level "Commercial use" section.
5. No file outside `libs/chat/` is modified.
6. The library still builds: `npx nx build chat` succeeds.
7. The published tarball contains LICENSE.md, LICENSE-COMMERCIAL.md, COMMERCIAL-USE.md, NOTICE.md, and CHANGELOG.md. Verify by running `pnpm pack` against `libs/chat/dist` and inspecting the resulting tarball with `tar -tzf`.
8. No new lint errors. `npx nx run chat:lint` is green.
9. No test changes; existing chat tests still pass.

## Risks

- **Registry tooling:** Some npm registry proxies reject `LicenseRef-*` SPDX identifiers. The fallback (`SEE LICENSE IN LICENSE.md`) is the documented escape valve. Decided during implementation by running `pnpm pack`.
- **Publish pipeline:** This PR does *not* publish a new version. The publish workflow change (which version to cut, who triggers it) is out of scope and stays with the release owner.
- **Public posture before pricing page exists:** Users who read this README before PR B lands will see references to "a Threadplane commercial license" without a public pricing page that explains tiers. Mitigation: README links to `LICENSE-COMMERCIAL.md` and `COMMERCIAL-USE.md` which describe the model without needing the website. PR B follows immediately.

## Verification commands

```bash
# Build
npx nx build chat

# Lint
npx nx run chat:lint

# Pack and inspect the tarball
cd dist/libs/chat && pnpm pack --pack-destination /tmp && tar -tzf /tmp/ngaf-chat-*.tgz | sort

# Confirm published files include all five new docs
tar -tzf /tmp/ngaf-chat-*.tgz | grep -E 'LICENSE\.md|LICENSE-COMMERCIAL\.md|COMMERCIAL-USE\.md|NOTICE\.md|CHANGELOG\.md'
# Expect 5 lines
```
