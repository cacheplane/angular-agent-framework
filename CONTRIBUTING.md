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
