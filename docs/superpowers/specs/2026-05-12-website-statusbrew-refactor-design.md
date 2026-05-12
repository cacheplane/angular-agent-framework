# Website refactor: modern SaaS aesthetic on the existing brand

## Summary

Refactor the marketing site (`apps/website`) to a cleaner, more confident, product-led SaaS look inspired by Statusbrew, while preserving the existing brand identity (deep-blue `#004090`, Angular red accent, EB Garamond editorial heads, MIT/dev-tool positioning). Drop glassmorphism, gradient blobs, and ambient washes. Replace with near-white surfaces, layered product screenshots in browser frames, and editorial typography.

This is a **developer-first** homepage refactor — the framework is the product. Pilot-to-Prod stays as a strong mid-page block but does not lead. Docs (`/docs/**`) are out of scope.

## Goals

1. Site feels like a modern, trustworthy dev-tool SaaS brand (Linear/Vercel/Resend territory) without losing the Angular Agent Framework's recognizable identity.
2. Product UI is prominent — layered static screenshots + one signature live demo.
3. Trust signals are honest — real proof (GitHub stars, npm installs, ecosystem listings), no borrowed customer logos.
4. Design system is reusable: same primitives drive every marketing page.

## Non-goals

- Docs styling (`/docs/**`) — different design language is appropriate for documentation.
- Dark mode (Phase 2, after light theme ships clean).
- Rebranding (logo, name, core positioning untouched).
- New illustrations or generic stock SaaS imagery.

## Audience

**Primary:** Angular developers and tech leads evaluating the framework. Decisions on signals/streaming/GenUI/MIT licensing. Conversion: `npm install` → docs → first integration.

**Secondary:** Engineering leaders considering the Pilot-to-Prod program. Mid-page block addresses them; they are not the top-of-funnel.

## Design system

### Tokens — `apps/website/lib/design-tokens.ts`

Full rewrite. Keep the file as single source of truth. New shape:

```ts
export const tokens = {
  colors: {
    // Surfaces
    canvas: '#fafbfc',           // page background
    surface: '#ffffff',          // cards, frames, nav
    surfaceTinted: '#f4f6fb',    // alternating sections
    surfaceDim: '#eef1f7',       // pricing-card highlight, callouts
    border: '#e6e8ee',           // 1px hairlines
    borderStrong: '#d2d6e0',     // emphasized borders

    // Text
    textPrimary: '#0f1729',
    textSecondary: '#475067',
    textMuted: '#6b7280',
    textInverted: '#ffffff',

    // Brand — retained
    accent: '#004090',
    accentHover: '#003070',
    accentLight: '#64C3FD',      // used sparingly for highlights/markers
    accentSurface: 'rgba(0, 64, 144, 0.06)',
    accentBorder: 'rgba(0, 64, 144, 0.15)',
    angularRed: '#DD0031',       // Angular badges/marks only
  },
  shadow: {
    sm: '0 1px 2px rgba(15, 23, 41, 0.04), 0 1px 1px rgba(15, 23, 41, 0.03)',
    md: '0 4px 12px rgba(15, 23, 41, 0.06), 0 2px 4px rgba(15, 23, 41, 0.04)',
    lg: '0 12px 32px rgba(15, 23, 41, 0.08), 0 4px 8px rgba(15, 23, 41, 0.05)',
    focus: '0 0 0 3px rgba(0, 64, 144, 0.25)',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    full: '999px',
  },
  type: {
    h1: { size: 'clamp(48px, 6vw, 72px)', line: 1.08, family: 'var(--font-garamond)' },
    h2: { size: 'clamp(36px, 4.5vw, 56px)', line: 1.12, family: 'var(--font-garamond)' },
    h3: { size: '28px', line: 1.25, family: 'var(--font-inter)', weight: 600 },
    eyebrow: { size: '12px', line: 1.4, family: 'var(--font-mono)', weight: 700, letterSpacing: '0.12em', transform: 'uppercase' },
    bodyLg: { size: '20px', line: 1.6, family: 'var(--font-inter)' },
    body: { size: '16px', line: 1.6, family: 'var(--font-inter)' },
    caption: { size: '14px', line: 1.5, family: 'var(--font-inter)' },
    mono: { family: 'var(--font-mono)' },
  },
  space: {
    sectionY: 'clamp(64px, 8vw, 120px)',
    sectionYTight: 'clamp(48px, 6vw, 80px)',
    containerX: 'clamp(20px, 4vw, 40px)',
    containerMax: '1200px',
  },
} as const;
```

**Removed:** `glass.*`, `gradient.*`, `glow.hero|demo|card|border|button` (replaced by `shadow.*` + `focus`).

CSS custom properties in `apps/website/src/app/global.css` mirror this token set 1-to-1.

### Primitives — `apps/website/src/components/ui/`

New files. All server components unless marked.

| File | Purpose | API sketch |
|---|---|---|
| `cn.ts` | `clsx` + `tailwind-merge` wrapper. | `cn(...classes: ClassValue[])` |
| `Container.tsx` | Max-width + responsive horizontal padding. | `<Container size="default | wide" />` |
| `Section.tsx` | Vertical rhythm + optional surface variant + optional eyebrow/headline header. | `<Section surface="canvas | tinted | white" tightTop tightBottom />` |
| `Button.tsx` | `cva` variants. | `<Button variant="primary | secondary | ghost" size="md | lg" href />` |
| `Card.tsx` | White card with border + `shadow.sm`, optional `hoverable`. | `<Card hoverable padding="md | lg" />` |
| `BrowserFrame.tsx` | Mac-style traffic lights + URL bar around an image, iframe, or arbitrary child. Supports `rotate`, `offset` for collage stacking, and `theme="light | dark"`. | `<BrowserFrame url="cockpit.cacheplane.ai" rotate={-2}><Image /></BrowserFrame>` |
| `Eyebrow.tsx` | Mono uppercase label. | `<Eyebrow>Stream</Eyebrow>` |
| `Pill.tsx` | Small rounded label / tag. Variants for brand-blue, Angular-red, neutral. | `<Pill variant="accent | angular | neutral">MIT</Pill>` |
| `FAQ.tsx` (client) | Native `<details>` with custom chevron animation. Kbd-accessible. | `<FAQ items={[{ q, a }]} />` |
| `LogoMark.tsx` | The 🛩️ + wordmark. | `<LogoMark size="sm | md" />` |

**Dependencies:** uses already-installed `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`. No new deps.

### Removed deps

- `framer-motion` — removed entirely. CSS transitions handle hover states; native `<details>` handles FAQ. Saves ~50KB.

## Homepage IA — `/`

12 sections, top to bottom. Each section ID maps to one component under `apps/website/src/components/landing/` (new names listed; old names being replaced are in parens).

### 1. Nav — `shared/Nav` (refactored in place)

Sticky top nav. White bg, transparent at top of page, gains `border-bottom` + `shadow.sm` on scroll.

- Left: `LogoMark`
- Center: Pilot to Prod · Docs · Solutions · Pricing · Examples (external)
- Right: GitHub icon link · `npm install @ngaf/chat` copy-pill · `Start with Angular` primary `Button`

Mobile: hamburger → full-screen sheet. No body-scroll lock complexity beyond what's there.

### 2. Hero — `landing/Hero` (new, replaces `HeroTwoCol`)

Two-column desktop, stacked mobile.

**Left:**
- `Eyebrow`: "Angular Agent Framework · MIT"
- `h1`: *Ship agentic Angular apps without rewriting your frontend.*
- `bodyLg` sub: *Signal-native streaming for LangGraph and AG-UI. Headless primitives plus opinionated compositions, built for Angular 20+ teams shipping to production.*
- CTA row: `Button variant="primary" size="lg" href="/docs"` ("Get started") + `Button variant="ghost" size="lg" href="https://cockpit.cacheplane.ai"` ("See it live →")
- Trust line (`caption`, muted): "MIT licensed · Works with LangGraph, AG-UI, and your existing Angular app."

**Right (collage):** three layered `BrowserFrame`s, slight stagger + rotation:
1. Back: cropped `chat-debug` screenshot (timeline with streaming message)
2. Mid (offset right + up): cropped GenUI surface (a rendered card with structured data)
3. Front (offset down + left): tiny code editor frame showing `agent().messages()` call

Background: solid `canvas` color. No blobs.

### 3. Proof strip — `landing/ProofStrip` (replaces `SocialProof`)

Single-row, no marquee, no borrowed logos.

`Eyebrow` centered: "Built in the open"

Row of 5 honest signals, each as a `Card`-like badge:
- GitHub stars (dynamically fetched at build time, fallback to static number)
- npm weekly installs (dynamic + static fallback)
- "Listed on LangChain Awesome"
- "Built for Angular 20+"
- "Used in the Cockpit reference app"

### 4. Different by design — `landing/Differentiator` (replaces `PositioningStrip` + `ProblemSection`)

Two parts in one section.

**Top (editorial, max 720px center column):**
- `Eyebrow`: "Why this exists"
- `h2`: *Built for Angular, not retrofitted.*
- Body: 2 short paragraphs. First names the gap (most agent UI work assumes React or a vanilla web component; Angular teams glue together ad-hoc streaming, lose interrupts, and re-implement thread state). Second names the bet (signals + DI are *better* substrates for agent UI than hooks — when they're used directly, not behind a port).

**Below (4-card grid, reusing current `PositioningStrip` copy):**
- Runtime · Streaming · Generative UI · License — keep current headlines and body verbatim. Re-skinned with new `Card`.

### 5. Stream — `landing/FeatureBlock` (new, reusable for sections 5/6/7)

Two-column, right-image desktop. Stacked mobile.

**Left:**
- `Eyebrow`: "Stream"
- `h2`: *Stream tokens to Angular signals — no glue code.*
- Body paragraph: ~3 sentences on how `provideAgent` + `agent()` give you signals for messages, status, errors, and interrupts; LangGraph and AG-UI adapters share the contract.
- Benefit bullets:
  - Token-level streaming straight into Angular signals
  - Thread state, interrupts, tool progress, branch/history
  - Adapters: LangGraph (`@ngaf/langgraph`), AG-UI (`@ngaf/ag-ui`)
  - One contract, swappable runtimes
- Supporting card row (3 small `Card`s): `provideAgent` · `AgUiAdapter` · `LangGraphAdapter` — each with a one-line description.
- CTA: `Button variant="ghost"` → "Read the streaming guide →" (`/docs/agent/api/agent`)

**Right:** `BrowserFrame` containing cropped `chat-debug` screenshot showing streaming. Small floating code pill (`<Pill variant="accent">agent().messages()</Pill>`) absolutely positioned over the frame's top-right corner.

### 6. Render — `landing/FeatureBlock` (same component, alternated layout)

Left-image desktop (alternation rhythm).

**Right (text):**
- `Eyebrow`: "Render"
- `h2`: *Generative UI that renders into your design system.*
- Body: server-emitted JSON specs become Angular components you already own. Vercel `json-render` + Google A2UI both supported.
- Bullets: per-component fallback API, readiness gate, A2UI v1 protocol, Vercel `json-render` adapter
- Supporting cards: `chat-timeline` · `chat-debug` · `GenUI surfaces`
- CTA: → "See @ngaf/render"

**Left:** `BrowserFrame` with GenUI surface screenshot (a structured card rendered into the chat, plus one small overlaid label "fallback ready").

### 7. Ship — `landing/FeatureBlock` (same component, right-image)

**Left:**
- `Eyebrow`: "Ship"
- `h2`: *Patterns built for production, not demos.*
- Body: error boundaries, observability hooks, fallback strategies — the stuff that turns a demo into a real app.
- Bullets: `error()` / `status()` / `reload()` signals, readiness gate, thread persistence, MIT — own it forever
- Supporting cards: `error/status/reload` · `readiness gate` · `thread persistence`
- CTA: → "Production patterns"

**Right:** **the one live demo.** `BrowserFrame` wrapping the live `cockpit.cacheplane.ai` iframe (lazy-loaded with intersection observer; show a placeholder card until in view). Caption below: "This is the framework running in production. Try it."

### 8. Pilot to Prod — `landing/PilotBlock` (replaces `PilotSolution`)

Full-bleed tinted section (`surface="tinted"`).

- `Eyebrow`: "For teams"
- `h2`: *Ship your first Angular agent in 8 weeks.*
- Body paragraph + 4 outcome bullets: working demo, hardened patterns, deploy-ready integration, team trained on the stack.
- CTA row: `Button variant="primary"` → "/pilot-to-prod" ("See the program") + `Button variant="secondary"` → "Book a call"

Visual right of text on desktop: stacked `Card` showing the 8-week timeline (4 phases: Discover · Build · Harden · Train), each with a one-line label.

### 9. White paper — `landing/WhitePaperBlock` (refactored from `WhitePaperSection`)

Two-column, white surface.

**Left:**
- `Eyebrow`: "Field report"
- `h2`: *The last-mile gap in Angular AI.*
- Body: 2 short bullets on what's in the whitepaper (concrete patterns; not vibes).
- CTA: email-gate `Button variant="primary"` → "Download (free)" with inline email input styled with new tokens.

**Right:** whitepaper PDF cover in a tilted `BrowserFrame` (slight `rotate={-2}`).

### 10. What we won't do — `landing/Promises` (new)

`Section surface="canvas"`. Center-aligned eyebrow + h2.

- `Eyebrow`: "Built on principles"
- `h2`: *What we won't do.*
- Sub: one short line: "Honest commitments, not aspirations."

5-up `Card` grid (3-col on tablet, 5-col on desktop, single column mobile). Each card has a short label + 1-line body:

1. **No vendor lock-in** — MIT today, MIT tomorrow. Use without us.
2. **No paid Angular tier** — The libraries stay open. Pilot-to-Prod is the only paid offering.
3. **No abandoned majors** — We follow Angular's LTS. When Angular ships, we ship.
4. **No closed-source primitives** — Headless primitives stay in the open repo.
5. **No required cloud service** — Self-host LangGraph + your Angular app. No phone-home.

### 11. FAQ — `landing/FAQ` (new)

`Section surface="white"`. Centered `Eyebrow` + `h2` "Questions".

Uses `ui/FAQ` accordion (native `<details>`).

| Q | A (drafted, please revise) |
|---|---|
| How is this different from CopilotKit or AG-UI directly? | CopilotKit ports React patterns to Angular. AG-UI is a protocol — you still build the Angular side. Angular Agent Framework is Angular-native: signals, DI, zoneless support, and adapters that hide the protocol so you can swap LangGraph for AG-UI without rewriting your UI. |
| Does it work with my existing Angular app? | Yes. Drop `provideAgent` (or `provideAgUiAgent`) into your `app.config.ts`. The headless primitives don't impose any UI; the chat compositions are opt-in. |
| Is it zoneless-compatible? | Yes. All signal flows are zoneless-safe. We test against zoneless apps. |
| Can I use this without LangGraph? | Yes. Use the `@ngaf/ag-ui` adapter for any AG-UI compliant backend, or implement the agent contract yourself. The Angular side doesn't know which runtime is behind it. |
| Is the Pilot-to-Prod program required? | No. The libraries are MIT-licensed and complete on their own. Pilot-to-Prod is for teams who want concierge delivery, not a paywall. |
| What does it cost? | Libraries: free, MIT. Pilot-to-Prod: scoped per engagement — see the pricing page. |
| Is this production-ready today? | Yes — the Cockpit reference app runs the full stack. We track Angular's release cadence and ship against current and one previous major. |
| Where do I report issues? | GitHub Issues. Pilot customers also get a private channel. |

### 12. Final CTA — `landing/FinalCTA` (replaces `PilotFooterCTA`)

`Section surface="tinted"`, generous padding, center-aligned.

- `h2`: *Stop stalling on agentic Angular.*
- Sub: *Install the framework, read the docs, and have a streaming chat in your app this afternoon.*
- CTA row: same as hero (`Get started` + `See it live →`).
- Below: small caption with `MIT · No signup required · No telemetry`.

## Other marketing pages

All migrate to the same primitives. Component reuse is high — each page becomes a sequence of `Hero` + `FeatureBlock` × N + `FAQ` + `FinalCTA`.

### `/pilot-to-prod`

- Hero: program-focused headline ("8 weeks. One working agent. Production-ready patterns.")
- `FeatureBlock` × 3: Discover · Build · Harden (the program phases)
- `Promises`: program-specific commitments (no lock-in, source delivered, IP yours)
- Testimonials placeholder (empty section, hidden until first customer quote lands — track as separate work item)
- `WhitePaperBlock` (same as homepage)
- `FAQ`: program-specific questions
- `FinalCTA`: "Book a discovery call"

### `/angular`

- Hero: "Signal-native streaming for Angular." Collage: `provideAgent` code + chat-debug screenshot.
- `FeatureBlock` × 2: Providers · Signals
- Live `AngularCodeShowcase` (existing) wrapped in `BrowserFrame`
- `FAQ`: Angular-specific (zoneless? versions? bundle size? signals API?)
- `FinalCTA`

### `/chat`

- Hero: "Drop-in chat for Angular agents." Collage: chat-timeline + chat-debug.
- `FeatureBlock` × 2: Compositions · Headless
- Live `ChatLandingCodeShowcase` wrapped in `BrowserFrame`
- `FAQ`
- `FinalCTA`

### `/render`

- Hero: "Generative UI without a second framework." Collage: GenUI surface screenshots.
- `FeatureBlock` × 2: Schemas · Fallbacks
- Live `RenderCodeShowcase` wrapped in `BrowserFrame`
- `FAQ`
- `FinalCTA`

### `/solutions`

- Hero
- 3-column `Card` grid (one card per solution) using `solutions-data.ts`
- Each solution detail page uses `Hero` + `FeatureBlock` shell
- `FinalCTA`

### `/pricing`

- Hero
- 3-tier card grid using a new `PricingCard` primitive (white card, recommended-tier gets `surfaceDim` background + accent border + accent CTA)
- `FAQ`
- `FinalCTA`

## Excluded routes

- `/docs/**` — docs design language stays
- `/api/**`
- `/llms.txt`, `/llms-full.txt`

## Product visuals — screenshot plan

Captured once during Phase 3. Stored as optimized WebP in `apps/website/public/screenshots/`. Replace whenever cockpit visually drifts.

| File | Source | Used in |
|---|---|---|
| `chat-debug-streaming.webp` | `cockpit` chat-debug with a token-streaming message visible | Hero collage (back), Stream block |
| `chat-debug-timeline.webp` | `cockpit` showing tool calls + AI message | Chat page hero |
| `genui-surface.webp` | A rendered GenUI card in chat | Hero collage (mid), Render block |
| `code-editor-snippet.webp` | A small VS Code window showing `provideAgent` setup | Hero collage (front) |
| `cockpit-overview.webp` | Wide shot of the cockpit landing | Examples link preview |
| `whitepaper-cover.webp` | The PDF cover, already in `/public/whitepapers` — re-export at hi-DPI | Whitepaper block |

Capture spec: 2x DPR, 1280-wide for full UI shots, 800-wide for cropped detail shots. WebP quality 85. Light theme only.

## Implementation phasing

| Phase | Scope | Visible? | Approx. PR size |
|---|---|---|---|
| 1 | Rewrite `design-tokens.ts` (new tokens added; old ones kept for compat). Add all `components/ui/*` primitives + `cn` helper. Update `global.css` custom properties. | No | medium |
| 2 | Refactor `shared/Nav` + `shared/Footer` against new tokens + primitives. Remove glass treatment from `AnnouncementToast`. | Yes (site-wide) | small |
| 3 | Capture screenshots into `public/screenshots/`. Parallelizable with phase 4. | No | tiny |
| 4 | Refactor homepage `/`. Build all 12 sections. Remove blobs from `page.tsx`. Old landing components stay (other routes still depend on some). | Yes (`/` only) | large |
| 5 | Migrate other marketing routes in order: `/pilot-to-prod` → `/angular` → `/chat` → `/render` → `/solutions` → `/pricing`. Each is its own PR. | Yes (per route) | medium each |
| 6 | Cleanup: delete unused landing components (verify via grep first). Remove `glass.*` and `gradient.*` tokens. Remove `framer-motion` from `package.json`. Lockfile surgical edit only — don't regenerate. | No | small |

Total: ~9 PRs over the sequence. Each phase independently shippable.

## Removed components (Phase 6, after migration)

To verify with grep before deletion:

- `HeroTwoCol`
- `PositioningStrip`
- `ProblemSection`
- `PilotSolution`
- `TheStack`
- `PilotFooterCTA`
- `SocialProof` (replaced by `ProofStrip`)
- `HomePilotCTA`
- `FeatureStrip`
- `ValueProps`, `ValuePropsTabs`
- `WhatIsIncluded`
- `RiskRemoval` (folded into `Promises` or `/pilot-to-prod` page)
- `CockpitCTA`
- `HowItWorks`
- `LibrariesSection`
- `FairComparisonSection`

Check `EmbedFrame`, `GenerativeUIFrame`, `LangGraphShowcase`, `DeepAgentsShowcase`, `WhitePaperGate`, `CitationBadge`, `CapabilityCard`, `ArchDiagram`, `ChatFeaturesSection`, `HighlightedCode`, `CodeBlock` — may still be referenced. Only delete what's actually orphaned.

## Accessibility + performance

- All new primitives semantic-HTML first (`<button>`, `<a>`, `<details>`, `<section>` with `aria-labelledby` to heading IDs)
- Color contrast: text `#0f1729` on `#fafbfc` = 16.5:1, accent `#004090` on `#ffffff` = 9.4:1 — both AAA
- Focus rings: `shadow.focus` token, visible on all interactive elements
- `prefers-reduced-motion` respected — CSS transitions become `none`
- Images: `next/image` with explicit width/height, WebP, lazy below the fold
- Live cockpit iframe in section 7: lazy via `IntersectionObserver`, placeholder until visible

## Verification

Each phase has its own verification:

- **Phase 1 (tokens + primitives):** primitives rendered in a temporary `/_dev/primitives` route, viewed in Playwright preview server, screenshotted across desktop + mobile breakpoints. Type-check + build pass.
- **Phase 2 (Nav/Footer):** site-wide visual smoke — every existing route loads without console errors, nav links work, mobile menu opens/closes, scroll-shadow appears.
- **Phase 4 (homepage):** Playwright e2e covering hero CTAs, scroll through all 12 sections, FAQ accordion expand/collapse keyboard nav, lazy-loaded cockpit iframe loads when scrolled into view. Lighthouse score targets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- **Phase 5 (per route):** route loads, primary CTA fires analytics event, no console errors.
- **Phase 6 (cleanup):** `tsc --noEmit` + production build pass; bundle-size delta reported (should be net-negative once framer-motion is gone).

## Items requiring user revision before implementation

These are drafted in the spec but the user should verify or rewrite before phases 4/5 ship:

- **FAQ answers (section 11)** — drafted to make the structure concrete. The "zoneless-compatible" and "tested against zoneless" claims especially need verification.
- **Promises content (section 10)** — five honest commitments. The "We follow Angular's LTS. When Angular ships, we ship." line is a real public commitment. Verify before shipping.
- **Proof signals (section 3)** — the "Listed on LangChain Awesome" badge claim needs verification before going live. If not true, replace with another real signal (Discord/Slack community count, contributor count, etc.).
- **Hero headline + sub** — drafted; iterate on voice.
- **Differentiator section copy** — drafted; iterate.

## Open items (track but don't block this spec)

- Real GitHub stars + npm install counts: dynamic at build via small data-fetch in `lib/proof-data.ts` with static fallback
- First testimonial / case study quote — leave hidden in `/pilot-to-prod` until available
- Dark theme — future work item, not part of this refactor

## Plan-level scoping note

This spec covers 6 phases. **Each phase should get its own implementation plan** rather than one mega-plan. Phase 1 (tokens + primitives) is the natural starting point — it's the foundation everything else depends on, has no visible site changes, and is easy to review in isolation. After phase 1 ships, we plan phase 2, etc.

## File-level change map

```
apps/website/
├── lib/design-tokens.ts           [REWRITE - phase 1]
├── lib/cn.ts                      [NEW - phase 1]
├── src/app/global.css             [REWRITE custom-property block - phase 1]
├── src/components/ui/
│   ├── Container.tsx              [NEW - phase 1]
│   ├── Section.tsx                [NEW - phase 1]
│   ├── Button.tsx                 [NEW - phase 1]
│   ├── Card.tsx                   [NEW - phase 1]
│   ├── BrowserFrame.tsx           [NEW - phase 1]
│   ├── Eyebrow.tsx                [NEW - phase 1]
│   ├── Pill.tsx                   [NEW - phase 1]
│   ├── FAQ.tsx                    [NEW - phase 1]
│   └── LogoMark.tsx               [NEW - phase 1]
├── src/components/shared/
│   ├── Nav.tsx                    [REFACTOR - phase 2]
│   ├── Footer.tsx                 [REFACTOR - phase 2]
│   └── AnnouncementToast.tsx      [REFACTOR - phase 2]
├── src/components/landing/
│   ├── Hero.tsx                   [NEW - phase 4]
│   ├── ProofStrip.tsx             [NEW - phase 4]
│   ├── Differentiator.tsx         [NEW - phase 4]
│   ├── FeatureBlock.tsx           [NEW - phase 4, reused 5/6/7]
│   ├── PilotBlock.tsx             [NEW - phase 4]
│   ├── WhitePaperBlock.tsx        [NEW - phase 4]
│   ├── Promises.tsx               [NEW - phase 4]
│   ├── FinalCTA.tsx               [NEW - phase 4]
│   └── …existing files            [DELETE in phase 6 once unreferenced]
├── src/app/page.tsx               [REWRITE - phase 4]
├── src/app/pilot-to-prod/page.tsx [REWRITE - phase 5]
├── src/app/angular/page.tsx       [REWRITE - phase 5]
├── src/app/chat/page.tsx          [REWRITE - phase 5]
├── src/app/render/page.tsx        [REWRITE - phase 5]
├── src/app/solutions/page.tsx     [REWRITE - phase 5]
├── src/app/pricing/page.tsx       [REWRITE - phase 5]
├── public/screenshots/*.webp      [NEW - phase 3]
└── package.json                   [phase 6: remove framer-motion]
```

## Out of scope / future work

- Dark theme
- Real customer testimonials (track separately)
- New whitepaper PDF design
- Email-capture analytics improvements
- A/B tests on hero copy
