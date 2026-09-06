# scroll-craft engine (vendored)

Source: https://github.com/nateherkai/scroll-craft — `plugins/nateherk-design/skills/scroll-craft/engine/scrollcraft.js`
Commit: 0b81622 (2026-09-04). Licence: MIT (LICENSE beside this file).

`scrollcraft.js` is byte-identical to upstream and MUST stay that way — `scrollcraft.spec.ts` pins its SHA-256. Upstream's CSS is deliberately not vendored: the few rules the homepage needs (the pinned `[data-sc-stage]` element sticky — the engine only warns when it is not — and `[data-sc-cue]` starting at opacity 0) are re-authored under the website's own style contract in `src/styles/landing.css` by the act that mounts the engine (`components/landing/StageAct.tsx`).

To update: copy the new file, re-run `shasum -a 256`, update the hash in the spec and the commit here.
