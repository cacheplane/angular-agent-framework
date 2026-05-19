# c-debug — aimock e2e: not applicable

The `c-debug` demo intentionally ships **without** an aimock-driven Playwright e2e suite. Aimock e2e for the other chat caps drives the demo by typing a prompt into a `<chat-input>` and asserting on the rendered conversation, but `c-debug` has no chat-input affordance — the demo's purpose is to show the standalone `<chat-debug>` viewer composition (timeline, state inspector, diff viewer) rather than a fully interactive chat surface.

See `app/debug.component.ts` — the template is exactly:

```html
<example-chat-layout>
  <chat-debug main [agent]="agent" />
</example-chat-layout>
```

If you want aimock-driven coverage for the debug surface, the demo would need to compose `<chat-debug>` alongside an input affordance (either by wrapping in `<chat>` or by adding a sibling `<chat-input>`). That's a demo-shape decision, not an e2e gap — track it as its own task if surfaced.

For now, only the manual smoke at `manual/debug.manual.ts` exercises this cap.
