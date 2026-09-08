# Homepage stage: five beats, one workflow

**Date:** September 8, 2026

**Status:** Approved through implementation and subsequent design revisions.
**Scope:** Homepage stage, Angular replay, recording, mobile stills, and shared install action. This supersedes the stage-specific decisions in the September 5 live-stage spec and the September 6 rail spec.

## Narrative and copy

The stage follows one realistic demo backup-retention review from policy discovery through an approved cleanup and generated audit. It uses the real Angular chat and a recorded LangGraph run. The homepage does not fabricate a transcript or call a live model while visitors scroll. Recorded prose is never edited; script changes require another live recording and still capture.

**Heading:** Everything your agent needs on screen.

**Subtitle:** Follow one workflow through tools, subagents, saved threads, approvals, and generated UI.

| Beat | Rail / mobile label | Evidence in the chat | Docs destination |
| --- | --- | --- | --- |
| `stream` | Tools & citations | Search the demo retention policy; stream an answer with linked citations. | `/docs/chat/components/chat-tool-calls` |
| `subagents` | Subagents | Dispatch research comparing 90- and 120-day retention. The child card streams inside the transcript; the parent incorporates its findings. | `/docs/langgraph/guides/subgraphs` |
| `persist` | Threads & branches | Restore the saved thread, then fork from the completed research checkpoint to revise the original 90-day proposal to 120 days. | `/docs/langgraph/guides/persistence` |
| `approve` | Interrupts & approval | Review the proposed deletions at the tool's actual approval interrupt, then resume. Retained backups remain protected. | `/docs/langgraph/guides/interrupts` |
| `render` | Generated UI | Show the actual cleanup audit in generated A2UI, including an editable multiline Follow-up notes field. | `/render` |

The current take reports two deletions, 48.7 GB freed, and six backups remaining. These are recording evidence, not handwritten marketing claims. Research uses the existing compiled child graph, announcement binding, tracker, and subagent card. No new library adapter or card is required.

## Rail and visual hierarchy

All five capability rows remain visible on desktop. Each contains a quiet progress check, a concise linked label, and a separate Docs link. Current and completed labels have stronger text contrast; future labels are muted. Labels navigate to their beat. Checks communicate progress and are decorative, not checkbox inputs or primary actions.

Tools & citations and Subagents navigate to a lead-in before their key reveal. The replay publishes the first search result and first child-stream event as optional `revealMs` values on its beat metadata, after presentation-time compaction. The website maps these to scroll progress and subtracts 2.5% of the act's travel (about 150 px at 900 px viewport height), clamping to the beat start. Other labels, and frames without reveal metadata, use a point just inside the beat. Docs links continue navigating directly to their existing documentation pages.

- Checks are 20 × 20 px with a 1 px neutral border and 5 px corner radius.
- Completed checks use a muted surface fill and secondary text color; the checkmark is 14 px at weight 500. The current outline uses secondary text color.
- Yellow emphasis belongs to the install CTA. Checks must not compete with it.
- No row descriptions, visible proof lines, separator rules, separate segment bar, or repeated closing ledger.
- No extra stage status copy such as “backup cleanup” or “research running.” Real product messages and subagent activity remain visible inside the chat.
- “Keep scrolling to approve.” is the single hold cue.

The ending appears once: **One workflow. Every step in your Angular app.** followed by **Spike it this week →** and the existing trust line with LangGraph and AG-UI.

## Desktop layout and playback

The chat remains tied to page scrolling. The stage upgrades to a pinned act only at page load when the viewport is at least 1024 px wide and 720 px tall and reduced motion is off. It uses the stills form otherwise, including frame failure. Resizing does not reselect the mode until reload.

The larger demo sits beside a 290 px rail, with a 28 px column gap inside a container capped at 1600 px with 32 px side padding. The pin starts 80 px below the viewport top and occupies the remaining viewport height. The frame retains a 1200:720 aspect ratio and fits available width and height: `min(100%, calc((100svh - 250px) * 5 / 3))`. Below 800 px viewport height, the height allowance becomes 300 px and rail spacing and heading size tighten.

The frame's displayed address is **demo.threadplane.ai**, without `/stage`. The actual replay iframe route remains `/stage?t=0`; its address is an implementation detail.

### Interaction while scrolling is paused

After 250 ms without page movement, and acknowledgement that the replay reached the requested time, the whole frame becomes pointer- and keyboard-accessible. Visitors can select debug tabs, inspect and expand State, scroll the transcript or inspector, expand subagent cards, copy content, and edit generated fields. No extra Inspect button is required.

Scrolling within the frame belongs to its local content, with overscroll contained. Scrolling the surrounding homepage immediately disables frame interaction and resumes the recorded timeline. The selected debug tab persists across seeks. The panel can close normally and reopen through its floating launcher; closing it releases the space reserved beside or below the chat.

The recording remains authoritative. Sending, stopping, regenerating, manually responding to an interrupt, or requesting a debug replay/fork opens the live demo at `/embed`; these actions do not mutate the replay agent. This starts a separate live session, without transferring the recorded thread or pending input. Local generated-form edits can be replaced when replay reconstructs an earlier state. Mobile stills do not gain chat interaction.

| Beat | Scroll share |
| --- | ---: |
| stream | 1.3 |
| subagents | 1.3 |
| persist | 1.2 |
| approve | 2.4 |
| render | 1.1 |

`STAGE_SPAN` is derived from these shares: the section spans 7.3 viewport heights. Cue windows and sampled test positions derive from the same map. This is continuous scrubbing through events within each beat, not a five-stop slideshow.

Presentation timing caps each recorded inter-event idle gap at 200 ms while preserving event order and payloads. Seek time is presentation time, not the original recording timestamp. Forward updates follow animation frames. Reload occupies 12% of the persistence beat. Approval holds from 46% to 58% of its beat; crossing that threshold resumes the recording. The final 15% of render holds on the mounted form. The timeline authors 600 ms for reload and 3000 ms for the interrupt interval.

Reverse playback reconstructs the agent by reset and fast-forward. Where supported, a native View Transition preserves the previous rendered frame until reconstruction, settling, and transcript scrolling finish. Transitions have no crossfade animation. Seeks are serialized and retain the latest pending destination. Browsers without the View Transition API fall back to ordinary replay seeking; they do not have the same visual masking guarantee. At shared run boundaries the outgoing run settles before the next begins.

## Mobile review and fallback

Mobile is a natural vertical page of five real recorded stills, in the same order as desktop. It has no pinned act or replay iframe. Reduced-motion, short-viewport, and no-JavaScript visitors also receive this form.

The heading and subtitle lead the section. Above each still is one compact row: quiet completed check, capability label, and Docs link. Nothing appears beneath the checkbox as explanatory copy. Each still has descriptive alt text. Links remain keyboard reachable, and the five rows do not repeat at the end.

Use the portrait capture below 768 px: 585 × 975 WebP, displayed responsively without distortion. Wider fallback layouts use the 1200 × 720 capture. There are ten assets, one per beat at each size, sourced from the same recording. The research capture exposes child content; approval shows the paused decision; render shows the audit. Each asset stays below 120 KB.

After the fifth still, show the same single ending and install action as desktop. No multiline `npm install` block appears in either layout.

Review at 360, 390, and 430 px widths. The companion review embeds the running homepage at the selected width so reviewers can scroll all five actual stills, follow documentation links, and exercise the real install dialog. Reload the embedded page when changing widths because stage eligibility is chosen on load. The companion shell is review tooling, not product UI.

## Shared install dialog

`StageInstallAction` opens the same `InstallDialog` component used by the hero, retaining its install options, dismissal, and focus behavior. The dialog is portaled to `document.body` to escape the pinned stage's clipping and transformed ancestors. The action has `aria-haspopup="dialog"` and keeps a quickstart href for no-JavaScript navigation. Do not introduce a second install UI or duplicate command source.

## Sources and acceptance

- Copy and destinations: `apps/website/src/lib/positioning.ts`.
- Timing and cues: website `stage-beats.ts`; replay `stage-timeline.ts`, `stage-controller.ts`, `stage-mode.component.ts`, and `stage-rewind.ts`.
- Presentation: `StageAct.tsx`, `StageStills.tsx`, `StageInstallAction.tsx`, and `landing.css`.
- Capture: `stage-script.ts`, `stage-recording.types.ts`, `stage-replay.json`, and the fixture/stills recording scripts. Angular and website beat unions must agree.
- Proof remains derived from the recording in `stage-proof.ts` and verified by fixtures, even though per-row proof prose is not displayed.

Acceptance covers all five beats and their links; research tool calls plus child-namespace events; restored and branched history; real approval and resumed audit; ten current stills; granular forward scroll and masked reverse reconstruction; mobile/no-JS/reduced-motion fallback; and opening and dismissing the shared install dialog. Interaction checks cover idle plus seek acknowledgement before unlock, immediate page-scroll locking, local frame scrolling, State tab persistence, generated-field editing, debug reopening, and mutation routing to the live demo. Recalculate scroll samples whenever shares change. Keep the source recording unmodified when adjusting presentation timing.
