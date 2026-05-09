# NGAF chat smoke checklist

Scope: validates the **published** `@ngaf/*` packages render and behave
correctly in a fresh consumer. Run after any release or whenever
changes land in libs/chat, libs/langgraph, libs/render, libs/ag-ui.

## Pre-flight

- [ ] `OPENAI_API_KEY` present in `examples/chat/python/.env`
- [ ] `nx run examples-chat-python:serve` running on :2024 — `curl localhost:2024/ok` returns `{"ok":true}`
- [ ] Smoke consumer started — page loads at :4200
- [ ] No console errors on initial load (license warning OK, telemetry DNS failure OK)
- [ ] No 4xx/5xx in the network tab on initial load

## Initial render (welcome state)

- [ ] Default route redirects to `/embed`
- [ ] Welcome heading renders ("How can I help?")
- [ ] All declared welcome suggestion buttons render with their labels
- [ ] Control palette renders top-right, fully expanded by default
- [ ] Palette mode segmented control highlights "Embed"
- [ ] Palette model dropdown shows the default model
- [ ] Palette debug toggle shows "off"
- [ ] Send button disabled when input is empty

## Send & receive (basic streaming)

- [ ] Type any prompt, click Send — input clears, user message renders immediately
- [ ] Typing indicator appears between send and first token
- [ ] Tokens stream visibly into the assistant bubble (not all-at-once)
- [ ] Final message stays after stream completes
- [ ] Auto-scroll keeps the latest content visible during streaming
- [ ] Send button re-enables after stream completes

## Stop mid-stream

- [ ] Send a long prompt
- [ ] Mid-stream, Send button has flipped to "Stop generating"
- [ ] Click stop — stream halts, partial response remains rendered
- [ ] No console errors; agent returns to idle; Send button returns

## Markdown surfaces (the partial-markdown render path)

Send a prompt that asks for each of the following. Check that each
renders correctly both during streaming and after completion.

> **Known regressions** documented in the chat 0.0.20 partial-markdown
> swap: tables and task lists may not match the previous (marked-based)
> rendering exactly. If a check fails, file an issue against
> `libs/chat` rather than skipping — the smoke checklist is the
> canonical "what should work" list.

- [ ] **Headings** — `# H1`, `## H2`, `### H3` all render at distinct sizes
- [ ] **Paragraphs** with **bold**, *italic*, and `inline code`
- [ ] **Bullet lists** including nested (2+ levels)
- [ ] **Ordered lists** with correct numbering
- [ ] **Task lists** — `- [ ]` (unchecked) and `- [x]` (checked) render as checkboxes
- [ ] **Fenced code blocks** with language hint — preserved as `<pre><code>`
- [ ] **Tables** with header row + 2+ data rows — column alignment preserved
- [ ] **Blockquotes** — visually distinct
- [ ] **Links** — clickable, open in new tab
- [ ] **Horizontal rules** — render as a line
- [ ] No raw HTML escapes through (e.g. `<script>` displayed as text, not executed)

### Streaming-specific markdown checks

- [ ] Mid-stream, an incomplete fenced code block (open ``` no close) renders
      as a code block (does not flash to plain text)
- [ ] Mid-stream, an incomplete table row does not corrupt the table
- [ ] No visible flicker / layout shift as tokens arrive
- [ ] Long response keeps autoscrolling to bottom

## Regenerate

- [ ] After a response completes, hover the assistant message — actions row appears
- [ ] "Regenerate response" button is present and enabled
- [ ] Click regenerate — old assistant message is replaced (not appended)
- [ ] Typing indicator appears, then tokens stream into the new assistant slot
- [ ] After completion, exactly **1 user / 1 assistant** in the conversation
- [ ] Server-side state matches: `curl localhost:2024/threads/<id>/state`
      returns 2 messages with `next: []`
- [ ] Repeated regenerate (3 times in a row) keeps state at 1u/1a each time

## Cross-mode persistence

- [ ] In `/embed`, send a message
- [ ] Navigate to `/popup` — same conversation visible
- [ ] Open the popup — message history is intact
- [ ] Navigate to `/sidebar` — same conversation
- [ ] Open the sidebar — message history is intact
- [ ] Send from `/sidebar`, navigate back to `/embed` — new message present

## Mode switching (route + URL)

- [ ] `/embed` renders `<chat>` inline, full viewport
- [ ] `/popup` renders a launcher button; clicking opens a floating window
      with `role="dialog"`, contains the chat
- [ ] `/sidebar` renders a launcher; clicking slides in a panel with
      `role="complementary"`
- [ ] Browser back/forward navigates between modes correctly
- [ ] Direct deep-link to `/popup` works (no flash of `/embed` first)
- [ ] Unknown route (`/foo`) redirects to `/embed`
- [ ] Closing the popup does not navigate; URL stays `/popup`
- [ ] Same for sidebar close

## Model picker

- [ ] Palette dropdown lists the configured models
- [ ] Selecting a different model — palette text updates immediately
- [ ] Send a message — backend log shows the new model name
      (or check `/threads/<id>/state` `values.model` field)
- [ ] Selection persists across page reload
- [ ] Selection persists across mode switches

## Debug overlay

- [ ] Toggle Debug ON in palette
- [ ] `<chat-debug>` overlay appears (bottom drawer)
- [ ] Debug overlay shows current agent signals (status, message count, etc.)
- [ ] Debug overlay updates live as messages stream
- [ ] Toggle Debug OFF
- [ ] Overlay unmounts; no console errors; DOM has no `<chat-debug>` element

## Control palette UX

- [ ] Click collapse handle — palette shrinks to single icon
- [ ] Click icon — palette re-expands
- [ ] Collapsed/expanded state persists across reload
- [ ] Palette never overlaps the chat input (must remain accessible)
- [ ] Palette is positioned above any popup/sidebar in z-order

## Keyboard & accessibility

- [ ] Tab order reaches: input, send button, suggestions (when shown),
      palette controls, message actions (when hovered/focused)
- [ ] Enter in input — sends message
- [ ] Shift+Enter in input — inserts newline (does not send)
- [ ] Escape closes popup or sidebar (when open)
- [ ] Send button has accessible name "Send message"
- [ ] Stop button (mid-stream) has accessible name "Stop generating"
- [ ] Regenerate button has accessible name "Regenerate response"
- [ ] Copy button has accessible name "Copy to clipboard" → "Copied"
- [ ] Popup window has `role="dialog"`
- [ ] Sidebar panel has `role="complementary"` and `aria-hidden` toggles correctly

## Error handling

- [ ] Stop the Python server (`Ctrl+C` on :2024) and try sending — UI
      surfaces an error in `<chat-error>`, does not crash
- [ ] Restart Python server and send again — recovers without reload
- [ ] Send with `OPENAI_API_KEY` invalid — error surfaces; no infinite spinner

## Lifecycle

- [ ] Reload the page mid-conversation — agent reconnects, history reappears
      from server state (NOT fresh empty state)
- [ ] Click "New conversation" in palette — welcome state reappears, prior
      conversation is no longer attached (next submit creates a new thread server-side)
- [ ] Browser back navigates routes correctly
- [ ] Selecting a welcome suggestion sends and clears the welcome state

## Browser hygiene

- [ ] No `console.error` after smoke run completes
- [ ] No `Uncaught` promise rejections
- [ ] No memory leak across 10 mode-switch cycles (DevTools heap snapshot
      stable, no detached `<chat-message>` nodes)
- [ ] Network tab — no failed `localhost:2024` requests except the
      well-known `runs/stream` `ERR_ABORTED` (SSE terminus, expected)

## Visual polish

- [ ] Chat content readable at default zoom
- [ ] Layout responsive: viewport at 1440px, 1024px, 768px, 480px — no
      horizontal overflow, palette stays in viewport
- [ ] Markdown styles match the rest of the app's typography
- [ ] No flash of unstyled content on initial load

## Capture

- [ ] If anything failed, capture: `SMOKE_RUN.md` (auto-generated by CLI),
      console logs (last 100 lines), network tab HAR export, screenshot.

---

# Phase 2+ sections (intentionally empty in Phase 1)

## Reasoning blocks

- [ ] Palette "Effort" dropdown lists 4 options
      (minimal (fast) / low / medium / high (visible reasoning))
- [ ] Default value is `minimal` on first load
- [ ] Effort selection persists across reload
- [ ] With model = gpt-5-mini and effort = high, send the puzzle prompt
      ("Solve a multi-step puzzle (try Effort = high)" welcome suggestion):
  - [ ] `<chat-reasoning>` pill appears with "Thinking…" + pulsing dot during streaming
  - [ ] Reasoning body auto-expands during streaming (markdown rendered)
  - [ ] After completion, pill collapses to "Thought for {duration}"
  - [ ] Click pill — body expands; click again — collapses
- [ ] With effort = minimal, same prompt — pill appears briefly or not at all
      (first-token latency low)
- [ ] Switch effort mid-conversation, send again — new message reflects new effort
- [ ] Cross-mode: send in /embed with effort=high, navigate to /popup,
      open popup — reasoning pill on the prior message still renders
- [ ] Server state shows `values.reasoning_effort` matches palette selection
      (`curl localhost:2024/threads/<id>/state`)

## Tool calls

- [ ] Click "What are Angular signals? (search + cite sources)" welcome suggestion
- [ ] During streaming: a tool-call card appears for `search_documents` with a running pill
- [ ] After tool completes: card collapses to "complete" pill
- [ ] Click the card — args + result panels expand
- [ ] AI response references documents inline (e.g. "Signals are... [1]")

## Interrupts / human-in-the-loop

- [ ] Click "Demo: ask for approval before a sensitive action" welcome suggestion
- [ ] AI begins planning, then calls `request_approval` tool — graph pauses
- [ ] Interrupt panel appears above the input with the AI's reason text
- [ ] Click Accept — graph resumes with `'approved'`; AI proceeds with the plan
- [ ] (New conversation, click suggestion again) — Click Edit, type a custom response in the prompt — graph resumes with the typed text
- [ ] (New conversation, click suggestion again) — Click Ignore — graph resumes with `'denied'`; AI acknowledges and stops
- [ ] During pause: server state shows the interrupt — `curl localhost:2024/threads/<id>/state` reports `next` includes the interrupted node and a pending interrupt value

## Citations

- [ ] Sources panel ("Sources") renders below the assistant message
- [ ] 3-5 citations listed with title, url, snippet preview
- [ ] Inline `[1]`, `[2]` markers in the message body link to the corresponding source
- [ ] Click a source title — opens the URL in a new tab
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows the AI message has `additional_kwargs.citations` with the list

## Generative UI / A2UI surfaces

- [ ] Click "Demo: render an interactive A2UI surface" welcome suggestion
- [ ] Parent AI emits a tool_call to `render_demo_form` (no plain markdown reply yet)
- [ ] Final assistant bubble renders an `<a2ui-surface>` (a Card titled "Quick feedback") instead of plain markdown
- [ ] Card contains: TextField labeled "Your name", ChoicePicker labeled "Rating" with options 1-5, Submit button labeled "Submit feedback"
- [ ] Required-name validation: Submit button shows the inline error "Name is required" / "Enter your name before submitting" while the name field is empty
- [ ] Type a name → validation error clears
- [ ] Pick a rating → ChoicePicker updates the data model
- [ ] Click Submit → `<a2ui-surface>` emits an `A2uiActionMessage` (event name `feedbackSubmit`); chat round-trips it as a new user submit
- [ ] AI replies conversationally referencing the submitted form (acknowledges receipt; may quote the name/rating)
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows: AI message with `tool_calls=[{ "name": "render_demo_form", ... }]`, ToolMessage with `content="rendered"`, AI message whose `content` starts with `---a2ui_JSON---\n`
- [ ] No console errors during the surface render or submit cycle

## Subagents

- [ ] Click "Demo: dispatch a research subagent" welcome suggestion
- [ ] Parent AI begins planning, then emits a tool_call to `research` — graph dispatches the subagent
- [ ] `<chat-subagents>` panel appears above the chat input with one running subagent card
- [ ] Card surfaces the subagent's status (running) and the tool-call args (topic) while the child runs
- [ ] Once the subagent completes, the active filter hides its card; parent AI emits its final summary message in the chat
- [ ] Server-side: `curl localhost:2024/threads/<id>/state` shows tool_calls included `{ "name": "research", ... }` and the subgraph's messages were emitted under a `tools:<id>` namespace
- [ ] No console errors during the subagent run; no flicker of the subagents panel during streaming

## Time travel / timeline

## Multi-thread
