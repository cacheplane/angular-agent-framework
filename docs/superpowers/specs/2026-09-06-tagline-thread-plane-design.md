# Tagline and description: "the open-source thread plane for enterprise agents"

Date: 2026-09-06. Status: approved in conversation, implemented in the same branch.

## Decision

The public tagline changes from "The AI agent UI framework for Angular." to:

> The open-source thread plane for enterprise agents.

The site description (meta description, npm/GitHub summary) becomes:

> The open-source thread plane for enterprise agents: chat, durable threads, persistence, human approvals, and generative UI for Angular, on LangGraph and AG-UI.

Both strings were supplied by Brian. The description is 159 characters, inside the 160-character meta budget enforced by `positioning.spec.ts`.

## Scope ("everywhere")

`apps/website/src/lib/positioning.ts` stays the single source of truth for the website. Derived strings change with it:

- `HERO_H1` = the tagline. `HERO_EYEBROW` drops "Open-source" so the hero does not say it twice.
- `PRIMARY_TAGLINE` / `HOME_TITLE` = `Threadplane — The open-source thread plane for enterprise agents` (em dash kept: `opengraph-image.tsx` splits on it for the brand name).
- `HOME_DESCRIPTION` = the description above.
- `LONG_SUBHEAD` (OG/Twitter default, About page) = the description expanded with the capability list, ending in "without replacing your backend or design system".
- `DEFAULT_SOCIAL_IMAGE_META.alt` in `site-metadata.ts` restated on the tagline.

Outside the website, every literal "the AI agent UI framework for Angular" is replaced with "the open-source thread plane for enterprise agents": root `README.md` (hero alt, tagline line, lead paragraph), the seven `libs/*/README.md` intros, `docs/gtm/messaging.md` positioning statement, and `gtm.md` §1–2. The GitHub repository description is set to the tagline plus description.

Tests pinning the old strings (`positioning.spec.ts`, `site-metadata.spec.ts`, `e2e/website.spec.ts`) are updated to the new ones. The public-copy contract gate has no rule touching these phrases.

## Out of scope

npm `package.json` descriptions (they describe each package, not the product), historical specs/plans under `docs/superpowers`, blog posts, and the `hero.svg` artwork (it carries no text).
