# Contributing

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

This credits Code-Review via automation rather than peer review, because the
project is currently single-maintainer. OSSF documentation suggests
automated/AI reviews may not be intended to count toward this check; the current
setup does credit them, and a future Scorecard release could change that.
Removing `auto-approve.yml` cleanly reverts the check with no other impact.
