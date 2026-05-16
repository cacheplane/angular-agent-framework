# c-* Aviation Prompt Rewrites — Design

**Date:** 2026-05-16
**Status:** Spec — pending implementation plan
**Series:** PR 2 of 4 in the c-* aviation theme rollout

## Goal

Rewrite the 7 simple `_build_prompt_graph()` prompts (messages, input, debug, interrupts, theming, threads, timeline) to use a shared aviation-assistant character. Keeps the c-* demo platform's narrative consistent without changing graph code — these graphs are all single-node `system_prompt + LLM` instances that load a prompt file at call time.

Out of scope:
- Any graph code changes (this PR is markdown-only)
- c-tool-calls, c-subagents (PR 1, already shipped)
- c-generative-ui dashboard (PR 3)
- c-a2ui contact form (PR 4)

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Shared character | "Aviation assistant" — friendly, knowledgeable. Same voice across all 7 prompts. |
| 2 | Persona consistency | Each prompt opens with the same line: "You are a friendly aviation assistant helping travelers with flights, airports, and trip questions." Differences are one-line specialization hooks, not whole-prompt rewrites. |
| 3 | Dataset reference | Mention the 10 supported airports (LAX, JFK, SFO, ORD, BOS, ATL, DFW, SEA, MIA, DEN) in prompts where it helps — these graphs don't have tools, but the LLM can still reason about them and produce realistic-sounding answers. |
| 4 | Primitive-specific hooks | Three prompts get explicit hooks for the chat-lib primitive they demonstrate: c-interrupts (booking confirmation), c-threads (multi-thread context awareness), c-timeline (multi-turn planning). The other 4 (messages, input, debug, theming) stay generic — their primitives don't require prompt-level direction. |

## The 7 prompts

Each prompt opens with this shared header:

```markdown
# Aviation Assistant — <Capability Name> Demo

You are a friendly aviation assistant helping travelers with flights, airports,
and trip questions. You're knowledgeable about commercial aviation and happy to
discuss anything from flight planning to airport amenities.

Note: this demo's mock dataset covers 10 US airports — LAX, JFK, SFO, ORD,
BOS, ATL, DFW, SEA, MIA, DEN — and 4 airlines (American, United, Delta,
JetBlue). For airports/airlines outside this list, you can still provide
general aviation knowledge but acknowledge the data limit.
```

Then per-prompt specialization:

**messages.md**: nothing extra. Default conversational behavior.

**input.md**: nothing extra. The chat-input primitive is what's being demonstrated; the LLM just needs to respond to whatever the user types.

**debug.md**: nothing extra. The chat-debug primitive shows internal state; prompt is generic.

**interrupts.md**: adds a hook —
```markdown
## Interrupt behavior

If the user wants to actually book a flight, ANY flight, pause and ask for
explicit confirmation before proceeding. Phrase it like:

> "I can help you book that flight. Before I proceed, please confirm:
> [airline] flight [number] from [origin] to [destination] for approximately
> $[mock price]. Reply 'confirm' or 'cancel'."

This pause demonstrates the chat-interrupts primitive's human-in-the-loop
gate. Do not actually charge anything; this is a UI demo.
```

**theming.md**: nothing extra. The theming primitive demonstrates host-side theme switching; chat content is generic.

**threads.md**: adds a hook —
```markdown
## Thread context

This demo showcases multiple parallel conversation threads (e.g., a "Tokyo
trip" thread and a "London trip" thread). Keep responses focused on the
specific destination/topic the user has been discussing in the current
thread. Don't reference details from other threads unless the user
explicitly mentions them.
```

**timeline.md**: adds a hook —
```markdown
## Timeline context

This demo showcases the chat-timeline primitive — users can scrub backwards
through conversation history and branch from any checkpoint. Multi-turn
trip planning is ideal: the user can ask "what about flying from BOS
instead?" or rewind and try a different destination. Keep your answers
relatively short (2-3 sentences) so each checkpoint is a clean unit.
```

## Files modified

| File | What changes |
|---|---|
| `cockpit/langgraph/streaming/python/prompts/messages.md` | Replace with shared header (generic) |
| `cockpit/langgraph/streaming/python/prompts/input.md` | Replace with shared header (generic) |
| `cockpit/langgraph/streaming/python/prompts/debug.md` | Replace with shared header (generic) |
| `cockpit/langgraph/streaming/python/prompts/interrupts.md` | Replace with shared header + interrupt hook |
| `cockpit/langgraph/streaming/python/prompts/theming.md` | Replace with shared header (generic) |
| `cockpit/langgraph/streaming/python/prompts/threads.md` | Replace with shared header + thread context hook |
| `cockpit/langgraph/streaming/python/prompts/timeline.md` | Replace with shared header + timeline context hook |

No code changes. No `chat_graphs.py` modification — the `_build_prompt_graph()` factory already loads these files at runtime.

## Testing

**Build verification:**
- `pnpm nx run cockpit-langgraph-streaming-python:build` or `uv sync` cleanly — no code change, but prompt files are read at graph-compile time. Should be a no-op syntactically.

**Manual chrome MCP smoke (post-merge, when OPENAI_API_KEY available):**
- chat-messages: "Tell me about flying from LAX to JFK"
- chat-interrupts: "Book me a flight to Miami" → expect pause/confirmation prompt
- chat-threads: open two threads, ask different trip questions, verify no cross-contamination
- chat-timeline: ask a multi-turn planning question, rewind, ask alternative

## Risks and mitigations

- **Prompt overfitting** — c-interrupts' interrupt hook is suggestive, not mandatory. The LLM might ignore it on some queries. Acceptable for a demo; if it becomes a real problem, future PR can switch c-interrupts to a programmatic interrupt via LangGraph's `interrupt_before` mechanism.
- **Dataset reference creep** — listing the 10 airports in every prompt is verbose but valuable for guiding the LLM to stay within mock data. Trade-off accepted.
- **"Friendly" voice drift** — all 7 use the same opener. If we later want to specialize a persona per demo, we go back and edit just that one. Low maintenance cost.

## Out-of-scope follow-ups

- PR 3 — c-generative-ui dashboard → airline KPI dashboard
- PR 4 — c-a2ui contact form → aviation booking form
- aimock e2e fixtures for the new aviation behaviors (low priority)
