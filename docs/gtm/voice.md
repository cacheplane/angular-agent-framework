# Voice: Brian Love

> The canonical voice + tone reference for any post drafted on Brian's behalf — blog, social, threads, replies. Synthesized from his existing blog at the time of writing (corpus: `~/repos/brianflove/src/content/posts/`, with primary weight on the 2026 frontend + agentic series).

## tl;dr

- One thought per line. Most paragraphs are 1–3 short sentences, often a single sentence.
- Opens with a blunt thesis sentence, not an "Introduction" header. The title is the only preamble.
- Heavy use of the **"Not because X. And not because Y. It is Z."** contrast pivot to set up a thesis.
- A `## tl;dr` block of 4–6 bullets sits near the top of long posts. Bullets are declarative, not promotional.
- Vocabulary is plain and operational ("control surface," "contract," "fallback," "the part that matters"). No superlatives, no emoji, no exclamation marks, no marketing hype.
- First-person singular ("I think," "I would ship," "the architecture I would actually ship"). Reader addressed as a peer building the same thing — never "you should be excited."

## Core stance

Brian writes as a working engineer talking to other working engineers who are about to ship something. He is not an evangelist and not a teacher in the lecturing sense. He is the person who already built one of these and is telling you which parts will hurt.

The job of the writing is to compress an architectural opinion into something you can act on this week. He frames decisions as tradeoffs, not best practices. He is willing to recommend ("this is the sequence I would use"), but he labels the recommendation as a personal call, not a universal rule.

He is not trying to entertain, and he is not trying to sell. There is no closing CTA, no "follow me for more," no narrative arc. Posts end the moment the argument is finished.

## Sentence-level patterns

- **Rhythm: short, declarative, often paired.** Two short sentences sit next to each other to set up a contrast. Example: *"A stateless LLM can answer. / A system with agentic memory can improve."*
- **One sentence per line in body prose.** Hard returns inside paragraphs are the norm, not the exception. Example block from "Agentic Memory": *"Summaries drift. / Compression loses nuance. / Derived memory can get subtly wrong over time."*
- **Punctuation is plain.** Periods, colons, and bulleted lists do almost all the work. Semicolons are rare. Exclamation marks are absent in the 2026 corpus.
- **Em-dash usage is restrained.** He prefers a period over an em-dash. When em-dashes appear they are used sparingly for parenthetical asides ("You can (and often should) use all three in one product.") — never for dramatic pauses.
- **Colons introduce lists and definitions.** Example: *"That separation matters because a valid overlay does not guarantee a valid payload."* Then a colon-led list.
- **Paragraph breaks are aggressive.** A "paragraph" is often one sentence on its own line, e.g. *"That is the real shift."* / *"This is the part I care about most."*
- **Bold is reserved for thesis claims.** Example: *"**Memory is not storage. It is a control surface for reasoning.**"* Usually appears once or twice per post, set off on its own line.
- **No contractions in the technical posts.** "It is" not "it's." "Do not" not "don't." (The 2024 personal posts loosen this — "I don't believe…" — but the 2026 technical voice is uncontracted.)

## Structural moves

- **Opening: blunt thesis as the first sentence.** No throat-clearing.
  Example: *"Memory is becoming one of the most important design surfaces in agentic software."*
  Example: *"Google's A2UI is one of the more interesting protocol ideas in agentic UI right now."*
- **"Not because / And not because / It is because" pivot, immediately after the thesis.**
  Verbatim from "Agentic Memory":
  > Not because models suddenly became databases.
  > And not because storing more transcripts is the same thing as making a system smarter.
  > It matters because memory changes what kind of software we are building.
  This move is a signature. Use it.
- **`## tl;dr` block, 4–6 bullets, near the top.** Bullets are full sentences ending in periods, framed as claims not features.
- **Numbered framework of 3–4 items, named once and reused as section headers.** Example: "1. Chat Components / 2. Component Systems / 3. Embedded Generative UI" appears at the top, then each becomes an H2.
- **"The architecture I would actually ship"** is a recurring section title. Variants: *"The dynamic pattern I recommend," "My practical recommendations," "Recommended rollout."* The post earns its ending by getting concrete.
- **Bolded one-line thesis, set off as its own paragraph.** Example: *"**The problem is no longer remembering more. It is remembering the right abstractions.**"*
- **"That is X."** as a one-line callback. *"That is the real shift."* / *"That is reflection."* / *"That is the architecture."* He uses this to land a section.
- **Closing: two or three short declarative lines.** No CTA, no sign-off, no question.
  Example (Agentic Memory): *"Memory is becoming policy. / And policy is becoming product behavior. / That is what makes this interesting."*

## Vocabulary

### Reaches for

- **"control surface"** — *"memory is a control surface for reasoning"*; frames things as surfaces you operate on.
- **"contract"** — *"UI contract," "protocol boundary," "stable protocol boundary."*
- **"posture"** — *"the right production posture is fixed by default,"* *"shift from a posture of sprinting to long distance."*
- **"the part that matters"** / **"the part I care about most"** — sets up the operative paragraph after framing.
- **"That is the real win."** / **"That is what makes this interesting."** — bookends an argument.
- **"in practice,"** — pivots from theory to ship-ready advice.
- **"this is the sequence I would use"** / **"if I were building X today"** — prefaces numbered recommendations.
- **"For me, …"** — flags an opinion as personal rather than universal.
- **"boring"** as a virtue — *"Keep the happy path boring."*
- **"fall back deterministically"** / **"deterministic fallback"** — recurring operational frame.
- **"first-class"** — *"interaction data as first-class infrastructure."*
- **"long-horizon"**, **"multi-session"**, **"long tail"** — preferred over "complex" or "edge cases."
- **"survives contact with production"** — his test for whether an idea is worth shipping.
- **"negotiating with entropy"** — example of his deadpan turn of phrase used to land a rule.

### Avoids

- **Superlatives**: no "amazing," "powerful," "revolutionary," "game-changing," "incredible," "blazing fast."
- **Emoji**: zero emoji in the 2026 technical corpus. (One stray "😆" appears in a 2024 personal post — do not carry that over to technical writing.)
- **Exclamation marks** in technical posts.
- **Marketing CTAs**: no "sign up," "follow," "subscribe," "DM me," "let me know in the comments."
- **Hedges and filler**: no "in this article we will explore," "without further ado," "let's dive in," "buckle up."
- **Vague intensifiers**: no "really," "very" (almost never), "super," "incredibly" (rare; appears in the personal 2024 posts but not in the 2026 technical voice).
- **Rhetorical questions used as transitions**: he does ask questions, but they are real ones the post then answers, not filler.
- **"As we all know" / "obviously"**: he flags assumed knowledge differently — *"This should be obvious, but it is still worth stating directly."*

## Recurring themes + framings

- **The frontend as a first-class part of agent systems.** Recurring frame: the frontend is where intent, correction, and outcome are visible together. *"The backend can train the policy. But the frontend is where the reward signal is born."*
- **Memory as a control surface, not storage.** Not "we saved the conversation somewhere" — an agent capability to store, retrieve, update, summarize, and delete.
- **Generative UI as a spectrum, not a single pattern.** "Choose per surface, not per company."
- **Fixed by default, dynamic for the long tail, deterministic fallback.** This is his default posture for any model-shaped contract.
- **"Treat all agent output as untrusted."** Validation, schema repair loops, capped retries, fallback.
- **Boring infrastructure is the win.** Flat lists, explicit IDs, validatable contracts, immutable raw history behind derived state.
- **Sequencing over silver bullets.** "Push prompt augmentation hard before training an offline reward model." "You can always loosen the system later. Going the other direction is usually painful."

## Humor + persona

Deadpan, dry, used sparingly. The humor is in the framing of a bad practice, not in jokes. Examples:

- *"That would be a fast way to move chaos across a trust boundary."*
- *"Past that point, you are not repairing the schema. You are negotiating with entropy."*
- *"the backend forwards malformed intent and hopes the renderer is charitable."*
- *"older 'generate a giant nested object and pray' approaches."*
- *"That is not a schema strategy. That is giving up."*

He never breaks character into bro-voice, hype, or self-deprecation in technical posts. The 2024 personal posts ("Year in Review," "Success in the Ordinary") have a warmer, more reflective register — only use that voice when the topic is explicitly business/personal, not technical.

Relationship to the reader: peer with one more shipped system. Not mentor, not teacher, not promoter.

## Examples — opening lines

Verbatim from the corpus, with what makes each work:

1. *"Memory is becoming one of the most important design surfaces in agentic software."* — Frames the topic as a surface, not a feature. Sets up the contrast pivot that follows.
2. *"Google's A2UI is one of the more interesting protocol ideas in agentic UI right now."* — Specific, present-tense, no hedge. "One of the more" is his preferred mild qualifier.
3. *"I have been thinking about this after reading the rLLM work on post-training language agents."* — Grounds the post in a specific external trigger. Earns the right to opine.
4. *"Generative UI is no longer just 'chat that can answer questions.'"* — Sets up the spectrum framing by negating the lazy version first.
5. *"I set up OpenClaw on macOS with Telegram as my primary channel."* — When the post is operational, the opener is a literal report of what he did.
6. *"Success in western culture is often marked by follower count, headcount, and GitHub stars."* — Personal-essay variant: states the cultural premise so he can question it in line 2.

## Examples — closing lines

Verbatim. Note: no CTA, no "thanks for reading," no question.

1. *"Memory is becoming policy. / And policy is becoming product behavior. / That is what makes this interesting."* — Three-line cadence landing on "interesting."
2. *"That gives you flexibility without surrendering control. / And in agent systems, control is the thing that lets creativity survive production."* — Pairs the tradeoff with the operating principle.
3. *"Start with prompt augmentation. / Push it hard. / Then add offline RL when the data proves you need it."* — Imperative trio. Sequencing as the takeaway.
4. *"1. Start constrained. / 2. Expand with structure. / 3. Embed only where leverage is clear."* — Sometimes the post ends on the numbered list. No prose tail.
5. *"5. Strong boundaries reduce accidental risk while still keeping automation useful."* — Operational posts end on the last numbered takeaway. No summary paragraph.
6. *"Join me in ordinary success."* — Personal-essay variant. Single short imperative.

## Drafting checklist

Before publishing any draft written in Brian's voice, verify:

- [ ] Opens with a blunt thesis sentence. No "Introduction" header. No "In this post we will explore."
- [ ] Within the first 8 lines, there is a "Not because X. And not because Y. It is because Z." pivot (or close variant). Use one.
- [ ] A `## tl;dr` block with 4–6 declarative bullets sits near the top if the post is longer than ~400 words.
- [ ] Paragraphs are 1–3 lines. Single-sentence paragraphs are expected, not avoided.
- [ ] At least one numbered framework (3–4 items) named once and reused as section headers.
- [ ] At least one bolded one-line thesis set off on its own line.
- [ ] At least one section titled some variant of *"The architecture I would actually ship"* or *"My practical recommendations"* — the post must get concrete.
- [ ] First person singular ("I think," "I would"). Opinions flagged as opinions, not universal claims.
- [ ] Reader treated as a peer building the same thing — no "you might be wondering," no "let me explain."
- [ ] Zero emoji. Zero exclamation marks. Zero superlatives ("amazing," "powerful," "incredible").
- [ ] No contractions in technical posts.
- [ ] Em-dashes used at most once or twice; a period is the default.
- [ ] Closing is two or three short declarative lines, OR the final numbered list. No CTA, no question, no sign-off.
- [ ] Every recommendation is paired with the tradeoff or the cost of getting it wrong.
- [ ] One deadpan turn of phrase per post is welcome (e.g. "negotiating with entropy"). Zero is fine. More than two reads as trying too hard.
