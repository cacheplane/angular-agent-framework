# scroll-craft verification of the homepage stage

The homepage carries one pinned scroll act (`[data-stage-act]`, spec §8 of
`docs/superpowers/specs/2026-09-05-homepage-live-stage-design.md`). This
directory runs scroll-craft's own harness against a production build of the
site and fails CI on what the harness reports as defects.

## What it verifies

`shoot.mjs` walks the page's scroll in eight positions per act, screenshots
each, and reports:

- **DEAD SCROLL** between two sample positions whose visible state signature
  did not change. The stage publishes its state in `data-sc-verify-state` and
  declares its authored hold with `data-sc-verify-hold="true"`, so the pinned
  interrupt inside the Approve beat is exempt and everything else is not.
- **CUES THAT NEVER PEAK**: a `[data-sc-cue]` line that never reaches full
  opacity anywhere on the page.
- **Contrast** of every cue line at its worst frame (fail below 3:1, thin
  between 3:1 and 4.5:1). Contrast is reported, not gated.

`verify-home.mjs` runs the harness per mode and exits 1 on a non-zero harness
exit, on a `DEAD SCROLL between:` line, or on a `CUES THAT NEVER PEAK:` line.
The modes are desktop 1440×900, phone 390×844, and reduced motion; the default
(`--modes desktop`) runs the desktop pass only, see below.

The harness sees the declared hold only while the frame answers: it reads
`data-sc-verify-hold` from the elements that carry `data-sc-verify-state`, and
the publisher writes that state from the frame's `{ applied, phase }` reply.
Before the frame is ready the act shows the poster and the check runs on the
rail cues alone, which still move through the hold (the hold lines fade in),
so a poster-only run is a weaker check, not a false failure.

### The phone and reduced-motion passes

Below 1024px and under reduced motion the page renders the four stacked
stills — no pinned act, no engine. The vendored harness waits for the engine's
`html.sc-ready` signal before it samples, so on the stills page those passes
time out (`waiting for locator('html.sc-ready')`) rather than report. And a
page with no `[data-sc-act]` gives the harness one sample at 100%, so even a
page that raised the signal would produce a one-frame sheet and no cue or
contrast lines. The two modes stay defined for a page that changes either of
those facts; run them with `--modes desktop,phone,reduced`.

## Running it locally

Build and serve the production site on a free port, then verify:

```bash
(npx nx serve website --configuration=production --port=4308 --skip-nx-cache &)
until curl -sf http://127.0.0.1:4308/ > /dev/null; do sleep 2; done
ln -sfn ../../../apps/website/content dist/apps/website/content
node apps/website/e2e/scroll-craft/verify-home.mjs --url http://127.0.0.1:4308 --out dist/stage-shots
```

The serve's own build dependency emits `dist/apps/website`; there is no
separate build step. It skips the Nx cache on purpose so that build is a real
one rather than a cache restore, and the `content` symlink is added only once
the server answers, so it lands on the directory the build has finished
writing rather than on one the build is still about to replace. Kill the
backgrounded serve when you are done (`lsof -iTCP:4308 -sTCP:LISTEN -n` names
the process).

The Nx build lands in `dist/apps/website` with a rewritten `next.config`, so a
bare `next start` cannot serve it; `nx serve --configuration=production` can.
The `content` symlink mirrors `playwright.config.ts`'s production mode.

Each mode writes numbered frames, `report.json`, and a tiled `sheet.png` to
`<out>/<mode>/` (`dist/stage-shots/desktop/sheet.png` and so on). The contact
sheet needs `ffmpeg` on the PATH; without it the frames and the report are
still written and the harness prints `contact sheet skipped`.

The harness uses an installed Chrome (`SCROLLCRAFT_CHROME` overrides the
auto-detected path) and resolves `playwright-core` from the repository root's
`package.json`, so run it from the repository root.

In CI the `website-e2e` job runs the desktop pass against the production
build and uploads every `sheet.png` as the `stage-shots` artifact.

## Provenance

`shoot.mjs` is vendored unmodified from scroll-craft at commit `0b81622`
(`plugins/nateherk-design/skills/scroll-craft/scripts/shoot.mjs`), the same
pinned commit as the engine in `apps/website/src/vendor/scrollcraft/`. It is
MIT licensed; the licence is `apps/website/src/vendor/scrollcraft/LICENSE`. It
is excluded from lint (root `eslint.config.mjs`, next to the engine) and must
not be reformatted, so that a byte comparison against upstream stays possible.
