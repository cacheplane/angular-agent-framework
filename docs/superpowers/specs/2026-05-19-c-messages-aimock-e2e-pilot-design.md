# c-messages aimock e2e pilot — design

> **Place in the larger plan.** Task #4 in the post-PR-#432 cleanup arc. First slice of "add aimock coverage to caps now eligible since per-cap backend deploys." This pilot covers `cockpit/chat/messages` only; the remaining 7 chat caps (input, threads, timeline, generative-ui, debug, theming, a2ui) follow as a single batch PR after the pilot proves the template.

## Goal

Add aimock-driven Playwright e2e coverage for the `c-messages` cap. Lock in the per-cap scaffold pattern (directory layout, port convention, fixture format, CI wiring) so the follow-up batch PR for the remaining 7 chat caps can copy verbatim.

## Non-goals

- Touching the other 7 chat caps (separate follow-up PR).
- Touching render, deep-agents, or langgraph caps (separate product-line PRs).
- New helpers in `libs/e2e-harness/src/` unless the c-messages spec genuinely needs one not present today. The bias is reuse.
- Recording-infrastructure changes. If hand-authored fixtures don't replay cleanly, fall back to the existing per-cap record script pattern; that's a known fallback, not new scope.
- Changes to `scripts/ci-scope.mjs` — the classifier already routes `cockpit/chat/*/angular/**` to `cockpit_e2e`.

## Template source

`cockpit/chat/interrupts/angular/e2e/` is the proven template. It contains:

- `playwright.config.ts` — defines `testDir`, single-worker config, baseURL pinned to the cap's angular port, points `globalSetup` at the local `global-setup-impl.ts` and `globalTeardown` at the shared harness.
- `global-setup-impl.ts` — 12-line file that calls `createGlobalSetup({…})` from `libs/e2e-harness/src/` with cap-specific paths and ports.
- `fixtures/c-interrupts.json` — aimock fixture JSON used by the shared harness's runner.
- `c-interrupts.spec.ts` — 29-line spec with 2 tests using helpers from `libs/e2e-harness/src/`.
- `scripts/` — optional record script (only needed if we end up recording rather than hand-authoring).
- `tsconfig.json` — local TS config for the e2e directory.

The c-messages pilot mirrors this structure 1:1, substituting paths, ports, and assertions.

## Files to create

```
cockpit/chat/messages/angular/e2e/
├── c-messages.spec.ts
├── playwright.config.ts
├── global-setup-impl.ts
├── tsconfig.json
└── fixtures/
    └── c-messages.json
```

And one modification:

```
cockpit/chat/messages/angular/project.json   # add `e2e` target (mirror c-interrupts)
```

No `record` target in `project.json` for the pilot — the fixture is hand-authored. Add the record target only if the fixture mismatch forces the fallback path.

## Ports and identifiers

From `apps/cockpit/scripts/capability-registry.ts`:

- `id: 'c-messages'`
- `angularProject: 'cockpit-chat-messages-angular'`
- `port: 4501` (angular)
- `pythonPort: 5501`
- `pythonDir: 'cockpit/chat/messages/python'`
- `graphName: 'c-messages'`

These flow into `global-setup-impl.ts` and `playwright.config.ts` baseURL.

## Fixture content

Single hand-authored fixture entry. The c-messages cap is a plain conversational passthrough (user message → `gpt-5-mini` → text response, no tools, no interrupts), so the fixture is one prompt/response pair.

Concrete shape (verbatim structure copied from `c-interrupts.json`, content substituted):

```json
{
  "fixtures": [
    {
      "match": {
        "messages": [{ "role": "user", "content": "Hello" }]
      },
      "response": {
        "content": "Hi! I'm the chat-messages capability demo. I show how ChatMessageListComponent, ChatInputComponent, and ChatTypingIndicatorComponent render together. Try sending a few messages to see the bubbles and typing indicator in action."
      }
    }
  ]
}
```

The exact `match` discriminator shape will be confirmed against `libs/e2e-harness/src/aimock-runner.ts` during implementation (Task 4B from the prior audit showed fixture files use `response.toolCalls[].name`-style keys; the matcher shape is what aimock's `addFixturesFromJSON` accepts).

## Spec assertions

Two tests in `c-messages.spec.ts`, both running against the aimock-replaying backend:

1. **User message renders.** Submit "Hello" via the input → assert `chat-message-list` contains a user bubble with that text.
2. **AI response streams in and renders.** Wait for the AI bubble → assert text contains a stable substring from the canned response (e.g., "chat-messages capability demo").

If `libs/e2e-harness/src/` already exports a helper like `sendPromptAndWaitForBubble`, reuse it. If not, the spec uses Playwright primitives directly (`page.fill`, `page.click`, `expect(locator).toContainText(...)`); a shared helper can be added in the follow-up batch PR if duplication emerges.

## CI wiring

Two changes outside the new `e2e/` directory:

1. **`cockpit/chat/messages/angular/project.json`** — add an `e2e` target mirroring c-interrupts:

   ```json
   "e2e": {
     "executor": "@nx/playwright:playwright",
     "options": {
       "config": "cockpit/chat/messages/angular/e2e/playwright.config.ts"
     }
   }
   ```

2. **`apps/cockpit/cockpit-e2e-wiring.spec.ts`** — append c-messages to the cross-check list so the spec verifies the new cap's e2e config matches its capability-registry entry. The exact diff depends on the spec's structure; implementer reads the file and follows the existing 4-cap pattern.

CI classifier already triggers `cockpit_e2e` for `cockpit/chat/*/angular/**` paths, so the new `e2e/` directory automatically participates.

## Verification

### Local

1. `npx nx test cockpit-e2e-wiring --skip-nx-cache` passes (new cap entry consistency-checked).
2. `npx nx e2e cockpit-chat-messages-angular --skip-nx-cache` boots the backend on 5501 + angular on 4501, replays the fixture, both tests pass.
3. `npx nx run cockpit-chat-messages-angular:build` still succeeds (unchanged build).
4. Existing 4 aimock cap e2es still pass — regression check that `libs/e2e-harness/src/` consumers weren't broken.

### CI

- `cockpit_e2e` gate green.
- `cockpit_smoke` + `cockpit_examples` + `Cockpit — build / test` all green (no regressions in the wider build).

## Risk surface

- **Hand-authored fixture mismatch.** Aimock matches on prompt + toolName + turnIndex. A wrong `match:` block silently misses. Mitigation: copy `c-interrupts.json`'s structure exactly, substitute payload only. If still missing, fall back to recording via a temporary record script (5-min path; document in PR description). Worst case: the fallback adds ~30 LOC and a `record` target.
- **Port conflict.** 4501/5501 verified non-conflicting in the registry today. Pre-flight `lsof -i :4501 :5501` covers runtime collisions during local verification.
- **e2e-wiring spec regression.** Adding a 5th cap entry to a spec that today verifies 4 must keep all 5 passing. Pre-flight: read the spec's existing iteration shape carefully before editing.
- **Aimock fixture replay shape drift.** If aimock library version changed since c-interrupts was authored, the shape may differ. Mitigation: spot-check `libs/e2e-harness/src/aimock-runner.ts` at implementation time to confirm the current accepted shape.

## Acceptance criteria

- `cockpit/chat/messages/angular/e2e/` exists with 5 files matching the template.
- `cockpit/chat/messages/angular/project.json` has an `e2e` target.
- `apps/cockpit/cockpit-e2e-wiring.spec.ts` includes c-messages in the cross-check list.
- `npx nx e2e cockpit-chat-messages-angular` passes locally.
- `npx nx test cockpit-e2e-wiring` passes.
- CI `cockpit_e2e` gate passes on the PR.
- Existing 4 aimock cap e2es continue to pass (no regression).
- No changes to `libs/e2e-harness/src/` unless adding a primitive that the c-messages spec genuinely needs and that the follow-up batch will reuse (justified inline in the PR description if so).

**End state:** A drop-in template (`cockpit/chat/messages/angular/e2e/`) the follow-up batch PR can copy 7 times — substituting paths, ports, capability id, and fixture content — to bring the other 7 chat caps to aimock parity.
