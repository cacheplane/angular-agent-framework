# ICP — ThreadPlane

> Operational doc. Edited by humans as we learn. The durable two-track ICP summary lives in [gtm.md §3](../../gtm.md).

## Developer track

**Buyer:** Angular engineer (senior / staff) actively building or evaluating an agent feature for a production Angular app.

**Buying signals**
- Lands on a comparison page (`/compare/*`) from organic search or referral.
- Copies the install command (`hero_install` or `compare_*_install` CTA).
- Starts a cockpit recipe with a stack hint matching their backend (LangGraph, AG-UI, custom).
- Returns to the same comparison page within 7 days.
- Hits the six-signal activation funnel and drops off at "thread_persisted" or "interrupt_handled" — those drop-offs are the most actionable.

These are the signals to instrument first in Spec 1. Baseline rates between them populate this section quantitatively once `developer-funnel` ships.

**Disqualifiers**
- Greenfield app with no Angular constraint — ThreadPlane is for teams that *must* stay on Angular.
- Hobby/learning project — we welcome them, but they aren't the ICP for prioritization.

**Where they hang out**
- Angular Reddit, ng-conf community, Angular Discord/Slack equivalents, LangChain forum, AG-UI / A2UI communities, dev.to/medium.

**What they need to see in 30 seconds**
- "Not another agent runtime. The Angular UI layer for LangGraph/AG-UI/A2UI."
- One install command.
- A working demo they can clone.

## Enterprise track

**Buyer:** Architect or engineering lead at an Angular-heavy company (SaaS, internal tools, fintech, healthcare, insurance, manufacturing, compliance-heavy workflows).

**Buying signals**
- Already using LangGraph or evaluating an agent framework.
- React rewrite is politically or technically impossible.
- Has a defined design system and cannot ship arbitrary JSON-rendered components.
- 50+ engineers in the Angular org.

**Disqualifiers**
- React-only frontend stack.
- "We'll figure out the UI later" — no committed agent project.
- Pure dev-tools company without an end-user-facing surface.

**Qualified-lead v1 definition (server-side)**
- Non-personal `email_domain` (rules out gmail/outlook/yahoo).
- Non-empty `company` field.
- `track=enterprise` (the surface they came from).

Tighten in Spec 7 if signal proves noisy.

**Vertical priorities (initial)**
1. Fintech / insurance / compliance — strongest fit for human-approval flows.
2. Healthcare — adjacent compliance + design-system rigor.
3. Internal-tools-heavy SaaS — high agent-affinity, low channel cost.
4. Manufacturing — interesting fit for tool-call lifecycle UX.

## What we do not yet know

- Conversion rates between funnel stages (Spec 1 will produce baselines).
- Geographic distribution of qualified leads.
- Time from first `$pageview` to `lead_qualified` for the enterprise track.
- Average time-to-first-message for developer track (cockpit instrumentation needed).

This document is updated when these become measurable.
