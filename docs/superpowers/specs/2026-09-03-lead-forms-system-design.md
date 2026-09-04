# Lead forms system: one kit, four surfaces

**Date:** 2026-09-03
**Status:** Approved design, awaiting implementation plan
**Surface:** `apps/website` — contact page, pricing page, homepage whitepaper block, announcement toast, footer newsletter
**Depends on:** the growth hard cutover (#968) and its follow-ups; every form already posts the growth envelope to Neon-backed routes

## 1. Goal

Every lead capture on threadplane.ai should look like one product, behave the same way, and be accessible by construction. Today five surfaces use four stylesheets, no shared input component, two label strategies, and three radii; only two have a focus state; success and error colors are hardcoded hex values; the footer newsletter input renders 26 px wide because its disclosure sits inside the flex row; and the whitepaper offer appears three times with three treatments.

The redesign is structural. Consistency comes from a shared form kit and one submission hook, not from a review checklist.

## 2. Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Scope | One form system composed into every surface. |
| Field style | Bordered, tokenized: one 44 px height, one 8 px radius, one focus ring, visible labels above the control. |
| Enterprise form | Trimmed to work email, company, timeline, message. Team size and Pilot-to-Prod interest move to the conversation. |
| Where the enterprise form lives | Merged into the contact page as an intent variant at `/contact?intent=enterprise`. The pricing page keeps a short CTA band, no form. |
| Whitepaper offer | Homepage block and toast both stay, both built on the kit. Footer stays newsletter-only. |
| Contact composition | Heading and lede on the left of a tinted band, the form in an elevated white card on the right, direct channels as chips under the heading. |
| Company domain inference | Deferred. Waits on changes landing in Dawn and possibly this repository. Not part of this spec. |
| Dark mode | Out of scope; the marketing site is light-only. |

Evidence behind the trim and merge: over the 90 days to 2026-09-03, PostHog recorded 11 contact successes, 8 whitepaper-block successes, 2 toast successes, 2 footer newsletter successes, and 0 enterprise-form submissions.

## 3. The form kit

New directory `apps/website/src/components/form/`.

| Piece | Responsibility |
|---|---|
| `Field` | Visible label, optional "(optional)" marker, help text, error line. Generates ids and wires `aria-describedby` and `aria-invalid` on its child control. Label: Inter 13 px, weight 500, above the control. |
| `TextInput`, `TextArea`, `Select` | Thin wrappers applying the shared control class and forwarding all native props, including `type`, `autoComplete`, `required`, `inputMode`. |
| `FormCard` | The elevated white card used on a tinted band. `compact` prop for the toast and the footer. |
| `SubmitButton` | The existing `Button` primitive with a `pending` prop that swaps the label and disables the control without changing its width. |
| `FormStatus` | Success and failure blocks with an icon, specific copy, and a next step. `role="status"` for success, `role="alert"` for failure and stale. |

One hook, `useGrowthForm`, replaces the per-surface copies of the submission flow. It owns the request snapshot (`growthFormRequestSnapshot`), the POST of the growth envelope, the stale-policy branch, the analytics events, and a status machine: `idle`, `pending`, `sent`, `failed`, `stale`. Surfaces pass the route, the facts, the surface and section names, and an optional `entry_point`.

### Styling

New file `apps/website/src/styles/forms.css` in the style substrate. It introduces tokens, defined once in the substrate's token file and consumed here:

| Token | Purpose |
|---|---|
| `--form-control-height` | 44 px standard, 36 px compact |
| `--form-control-radius` | 8 px |
| `--form-focus-ring` | accent border plus 3 px soft accent shadow |
| `--form-error-ring` | error border plus 3 px soft error shadow |
| `--color-status-success`, `--color-status-error` | replace the hardcoded `#1a7a40`, `#c00`, and the Angular red used for form errors |

The old form rules are deleted: `.contact-form-*` and `.lead-form-*` from `marketing.css`, the form parts of `.wp-*` from `landing.css`, `.footer-newsletter-*` and `.toast-input`-family rules from `chrome.css`, and the footer's Tailwind utility classes. `forms.css` gets style-contract entries for the load-bearing declarations: control height, focus ring, error ring, and the footer row layout.

## 4. Surfaces

### Contact page, `/contact`

Tinted band. Left column: eyebrow "Contact", heading "Talk to an engineer.", lede "Tell us what you are shipping. We reply within one business day, usually with code, not a calendar invite.", then direct-channel chips: the founder address, GitHub issues, Discord. Right column: `FormCard` with the form.

Fields: Work email (required), Name (optional), Company (optional), "What are you shipping?" (optional textarea). Disclosure paragraph above the button, unchanged in substance. Button: "Send to Brian". Success replaces the card body with "Sent. Expect a reply within one business day." and leaves the chips visible.

**Enterprise variant**, `/contact?intent=enterprise`, read on the server so it renders without a flash:

- eyebrow "Enterprise"; heading unchanged;
- Company becomes required ("Tell us the company so we can prepare.") and a required Timeline select follows it: This quarter, Next quarter, 6+ months, Just exploring;
- textarea prompt "Tell us about your use case";
- button "Request a conversation";
- posts to `/api/leads` with `form_kind: 'pricing'` and `timeline`, which the route already accepts; analytics surface `pricing`, plus `entry_point` naming the pricing button that linked here.

### Pricing page, `/pricing`

The lead-form section is replaced by a CTA band: eyebrow "Enterprise", heading "Choose the support. Add delivery if you need it.", one sentence, one button to `/contact?intent=enterprise`. The three plan buttons and the Pilot-to-Prod link point to the same URL with distinct `entry_point` values. `LeadForm.tsx`, its CSS, and its spec are deleted.

### Whitepaper block

Composition unchanged: rail, three rows, cover art. The input becomes a kit `Field` with the visible label "Work email"; the button becomes `SubmitButton` with "Get the field report" and pending "Sending the guide…". Success is a `FormStatus` block: "Check your inbox. The guide is on its way, and the PDF is here too." with the direct PDF link. Failure offers the direct PDF link.

### Announcement toast

Trigger, dismissal, and copy unchanged. Shell becomes `FormCard compact`; input and button become compact kit pieces; the three ad-hoc font sizes go. Success uses the whitepaper `FormStatus` copy and keeps the auto-dismiss.

### Footer newsletter

Disclosure moves below the input row, which fixes the collapsed input. A visible compact label "Email" above the row, input and button at compact size, button "Subscribe", pending "Subscribing…". Success: "Subscribed. The first note from Brian arrives within a day."

## 5. Behavior and copy

- **Validation** runs on blur, never per keystroke; an error clears as soon as the value is valid; submit runs a final pass and moves focus to the first invalid field on every surface, including the single-field ones.
- **Error copy names the fix**: "Enter a full address, like jordan@acme.dev." and "Choose a timeline so we can route this." Errors are text plus an icon beside the field, linked by `aria-describedby`, never color alone.
- **Work email** is the label on contact, enterprise, and whitepaper; any address is accepted. The newsletter label is "Email".
- **Pending buttons** keep their width. Labels: "Sending…", "Sending…", "Sending the guide…", "Subscribing…".
- **Failure copy** says "That did not send." and offers the surface's fallback: the founder address, the direct PDF, or "try again".
- **Stale policy** keeps its refresh path, rendered through `FormStatus`.
- **Disclosures** keep their text, since they are the stored consent record, and render as one muted paragraph directly above the button on the stacked forms (contact, enterprise, whitepaper, toast). The footer's compact row is the exception: its disclosure renders below the input-and-button row, outside the row, so it can never take the input's space again. The button references the disclosure by `aria-describedby` on every surface.
- **Voice**: no contractions, declarative sentences. Replaces "We'll be in touch" and "You're subscribed".

## 6. Accessibility

Every control has a visible label; placeholders are examples only. Focus ring satisfies WCAG 2.2 focus appearance. Every target, including the toast's "Not now" and the footer button, is at least 24 px. `autocomplete` values: `email`, `name`, `organization`. No entrance transition under `prefers-reduced-motion`. Success uses `role="status"`; failure and stale use `role="alert"`.

## 7. Server and analytics

No change to route validation, the growth envelope, the policy version check, the acquisition session id, the disclosure text, or the lifecycle service.

Analytics event names and surface values are unchanged (`contact`, `pricing`, `home_whitepaper`, `toast`, `footer`). The enterprise variant reports surface `pricing` with `entry_point`. Firing submit, success, and fail from the hook fixes the current gap where some success events arrive without a surface.

## 8. Testing

- Component specs for each kit piece; hook spec covering every state and the analytics calls.
- Existing surface specs updated for the new markup, plus the enterprise variant and the pricing CTA band.
- Style-contract entries for control height, focus ring, error ring, and the footer row layout.
- Website e2e: the four form-flow cases rewritten; an enterprise-intent case added; a footer case asserting the input width exceeds a minimum.
- Manual gate after each deploy: one real submission per surface, checked in Neon and in PostHog by surface.

## 9. Rollout

Three PRs, each leaving every surface working because each merge auto-promotes:

1. Form kit, `forms.css`, tokens, style-contract entries, and the footer newsletter on the kit. Repairs the live defect.
2. Contact page with the enterprise variant, pricing CTA band, deletion of `LeadForm`.
3. Whitepaper block and announcement toast on the kit; deletion of the remaining old form CSS.

## 10. Deferred

- **Company domain inference** from the email address. Waits on changes landing in Dawn and possibly this repository. When it resumes, the intended shape is: derive `work` classification and `company_domain` for non-free-mail domains in the shared accept path, tag the activity with the source, and leave enrichment unchanged.
- An explicit "company website" override for agencies, if they become a real share of leads.
- Dark mode for the marketing site.
