# c-debug — aimock e2e: not applicable

The `c-debug` demo ships **without** an aimock-driven Playwright e2e suite. It now composes `<chat>` alongside `<chat-debug>`, so the demo is drivable in principle:

```html
<example-chat-layout>
  <chat main [agent]="agent" />
  <chat-debug main [agent]="agent" />
</example-chat-layout>
```

What is still missing is a recorded fixture for this capability. Adding aimock coverage here means recording a first turn against the `c-debug` graph and asserting on the dock's timeline rows once it is opened from the fixed launcher. Track that as its own task.

For now, only the manual smoke at `manual/debug.manual.ts` exercises this cap.
