# cockpit/render — aimock e2e: not applicable

The 6 render capability demos (`spec-rendering`, `element-rendering`, `state-management`, `registry`, `repeat-loops`, `computed-functions`) intentionally ship **without** aimock-driven Playwright e2e suites. The cockpit aimock pattern drives demos by typing a prompt into a `<chat-input>` and asserting on the rendered conversation, but render demos have a fundamentally different shape:

- **No chat-input**: render demos use a spec picker (hardcoded sample specs in `app/specs.ts`) instead of a chat surface.
- **No LLM backend wiring at the UI**: each cap's python backend exists for the LangGraph manifest, but the Angular demo uses an in-process `StreamingSimulator` (see `cockpit/render/shared/streaming-simulator.ts`) to stream the chosen spec locally rather than calling the backend.
- **No chat-message bubbles**: the cap renders directly via `<render-spec>` / `<render-element>` primitives from `@threadplane/render`.

The right testing approach here is **direct component testing of the render pipeline**:
- Mount the `RenderSpecComponent` with a fixture spec.
- Assert the rendered DOM matches expectations.
- Exercise the StreamingSimulator's partial-state behavior in unit tests.

Existing coverage:
- `cockpit/render/shared/streaming-simulator.spec.ts` — vitest unit tests.
- `cockpit/render/matrix.spec.ts` + `cockpit/render/footprint.spec.ts` — vitest structural checks.

If a render-specific e2e harness is desired in the future (visual diffs, interactive scrubbing), it would be a separate cycle. The aimock pattern from cockpit-chat / cockpit-langgraph caps does not fit.

This file is the deliberate "no e2e" marker matching the c-debug README (`cockpit/chat/debug/angular/e2e/README.md`).
