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
