# Contributing

Threadplane is MIT-licensed and developed in the open. Contributions are welcome.

## How to contribute

1. **Found a bug or have a feature idea?** Open an issue at
   <https://github.com/cacheplane/angular-agent-framework/issues> describing the
   problem or proposal. Please search existing issues first.
2. **Code changes:** fork the repository (or create a topic branch if you have
   access), make your change on a branch, and open a pull request against `main`.
   Keep pull requests focused on a single concern.
3. Every pull request runs CI (lint, test, build) and receives an automated code
   review; the maintainer reviews and merges.
4. **Security issues:** do not open a public issue — see [SECURITY.md](SECURITY.md)
   for the private vulnerability-reporting process.

## Working in a git worktree

A `git worktree` gets a fresh checkout but **not** a fresh `npm install`. Node
resolves modules by walking *up* the directory tree, so a worktree created inside
this repository silently inherits the main checkout's `node_modules` and mostly
works — which is why the gaps surface as unrelated-looking failures well into a
task rather than up front.

Run install once per worktree before building anything:

```bash
npm ci
```

`npm ci` installs strictly from `package-lock.json` and never rewrites it, so it
is safe on any platform (regenerating the lockfile is not — see the note below).
Three failure signatures come from skipping it. They look unrelated but share one
cause, and each is fixed by the install above:

| Symptom | Why inheritance doesn't cover it |
| --- | --- |
| `Cannot find module 'posthog-node'` when building `website` | Installed only into `apps/website/node_modules`, never hoisted. The walk up from the worktree's `apps/website/` never passes through the main checkout's. |
| `Could not resolve "node_modules/katex/dist/katex.min.css"` | Referenced by literal path from the workspace root, not by module resolution — so there is no upward walk to inherit through. |
| `Next.js inferred your workspace root, but it may not be correct` when building `cockpit` | Turbopack resolves its own workspace root and will not compile outside it. |

Do not fix these by copying individual packages from the main checkout. The list
keeps growing, a partial copy pulls in a package without its transitive
dependencies, and a mistargeted `cp` can overwrite `node_modules` itself.

Do not run `npm install` in a worktree on macOS either: it rewrites
`package-lock.json` and drops the Linux `@next/swc-*` bindings, which breaks CI.
`npm ci` is the safe command.

One more worktree-only trap, after install: `nx build cockpit` can die with a
Turbopack panic — `FileSystemPath(...).join(...) leaves the filesystem root` —
whenever a website `.next` cache exists anywhere in the workspace
(`apps/website/.next` from `next dev`/e2e, or `dist/apps/website` from a build).
Those caches contain a `node_modules` symlink whose relative target resolves
through the *main* checkout's root; the path is valid on disk, but Turbopack's
virtual filesystem refuses to traverse above its project root and panics.
Pinning `turbopack.root` does not help. Clear the caches instead:

```bash
rm -rf apps/website/.next dist/apps/website && npx nx build cockpit
```

CI never hits this — its jobs build from fresh checkouts that are not nested
inside another checkout.

## Testing

New functionality and bug fixes must include automated tests. Run a project's
suite with `npx nx test <project>` (for example, `npx nx test chat`). CI runs
`lint`, `test`, and `build` across the publishable libraries on every pull
request, so changes that break or skip tests are caught before merge.

## Signed commits

`main` requires signed commits. Configure SSH commit signing once:

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

Then add the same public key as a **Signing Key** at
<https://github.com/settings/ssh/new>. Commits merged through the GitHub UI and
bot commits (Renovate, Dependabot) are signed automatically.

## Code review

Every PR gets a genuine advisory AI code review
(`.github/workflows/claude-review.yml`) that posts findings as comments — it is
not a required check and never blocks a merge. A second workflow
(`.github/workflows/auto-approve.yml`) then submits a formal approval as
`github-actions[bot]` — an identity distinct from the PR author — which OSSF
Scorecard's Code-Review check reads from the reviews API. The maintainer still
merges every PR.

Because the review is advisory, **handling its comments is a convention, not a
gate**: before arming auto-merge, the author reads each AI comment and either
addresses it in a follow-up commit or replies on the thread with the reason for
deferring/declining. Don't merge past unread review comments — the check going
green (or red) says nothing about whether the comments were considered.

This credits Code-Review via automation rather than peer review, because the
project is currently single-maintainer. OSSF documentation suggests
automated/AI reviews may not be intended to count toward this check; the current
setup does credit them, and a future Scorecard release could change that.
Removing `auto-approve.yml` cleanly reverts the check with no other impact.
