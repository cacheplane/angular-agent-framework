# Website Audit — Mobile Responsive & Design Improvements

## Goal

Fix four mobile layout/accessibility bugs and ship four design improvements to increase credibility and lead capture surface area.

## Tech Stack

- Next.js 16, React 19, TypeScript
- Framer Motion (existing)
- Tailwind CSS + inline styles (existing patterns)
- `@cacheplane/design-tokens` for colors/glass values

---

## Mobile Responsive Fixes

### 1. ChatFeaturesSection — overflow on mobile

**File:** `apps/website/src/components/landing/ChatFeaturesSection.tsx`

**Bug:** The 3-column grid uses `gridTemplateColumns: '1fr 440px 1fr'`. On viewports < 768px, the total width exceeds the screen by ~280px. The right callout cards overflow off-screen.

**Fix:** Add a `@media (max-width: 767px)` breakpoint (or use a `useMediaQuery` hook consistent with HeroTwoCol):
- Replace the 3-column grid with a single-column stack
- Chat window: `width: 100%`, remove the fixed `440px`
- Callout cards: render as a 2-column grid below the chat window (or a horizontal scroll strip)
- Tab buttons: ensure they wrap or scroll horizontally if they overflow

### 2. FairComparisonSection — cramped table on mobile

**File:** `apps/website/src/components/landing/FairComparisonSection.tsx`

**Bug:** The 3-column grid (`1fr 1fr 1fr`) renders at 3 x 164px on a 375px viewport. Text at 0.62–0.8rem in 164px columns is barely readable. The `@langchain/langgraph-sdk` header truncates.

**Fix:** At `< 768px`:
- Hide the header row (column labels)
- Each capability row becomes a stacked card:
  ```
  [Capability name]
  Without: [description]
  With: [checkmark + description]
  ```
- Cards separated by subtle dividers or spacing
- Add inline labels ("Without", "With") since the header is hidden

### 3. Touch targets — below WCAG minimum

**Files:**
- `apps/website/src/components/landing/CitationBadge.tsx` — 13x13px button
- `apps/website/src/components/shared/Nav.tsx` — 20x20px hamburger
- `apps/website/src/components/shared/Footer.tsx` — 18x18px social icons

**Fix:** Add `min-width: 44px; min-height: 44px` hit areas using padding. The visual icon size stays the same — only the tap target grows. Use `display: inline-flex; align-items: center; justify-content: center` to center the icon within the larger hit area.

### 4. Sub-12px text on mobile

**Files:**
- `apps/website/src/components/landing/StatsStrip.tsx` — stat labels
- `apps/website/src/components/landing/ProblemSection.tsx` — progress bar labels, stall marker

**Fix:** Replace hardcoded small font sizes with `max(12px, <current-size>)` or add a mobile media query that bumps monospace labels to 12px minimum. Only affects decorative/label text — body copy is already fine.

---

## Design Improvements

### 5. Social proof strip

**File:** Create `apps/website/src/components/landing/SocialProof.tsx`

**Placement:** After `<StatsStrip />`, before `<ProblemSection />` in `page.tsx`.

A horizontal strip showing:
- GitHub stars count (hardcoded initially, can be dynamic later)
- npm weekly downloads badge
- "Source Available" indicator

Use the existing glass card styling. Keep it compact — one row, centered, max-width matching other sections. Stagger entrance with `whileInView` like other sections.

### 6. Footer newsletter signup

**File:** `apps/website/src/components/shared/Footer.tsx`

Add an email input + "Subscribe" button in the brand column (column 1), below the tagline and above the social icons. Form posts to `/api/newsletter` (created in Spec 2). Show `'idle' | 'submitting' | 'done' | 'error'` states matching the existing form pattern in WhitePaperSection.

### 7. White paper soft gate

**File:** `apps/website/src/components/landing/WhitePaperSection.tsx`

Restructure the two-column layout:
- **Left column (primary):** Form with Name (optional) + Email (required) fields. Submit button: "Send me the guide". Below the form: small muted link "or download directly" pointing to `/whitepaper.pdf`.
- **Right column:** Keep the existing value prop copy (chapter list, description).

Form submission hits `/api/whitepaper-signup` which now sends the PDF link via email (Spec 2). The direct download link ensures no one is truly blocked.

### 8. OG/meta tags

**File:** `apps/website/src/app/layout.tsx`

Add `generateMetadata` or static `metadata` export:
```ts
export const metadata = {
  openGraph: {
    title: 'Angular Agent Framework',
    description: 'Signal-native streaming for LangGraph — production patterns your Angular team can own.',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Angular Agent Framework',
    description: 'Signal-native streaming for LangGraph — production patterns your Angular team can own.',
    images: ['/og-image.png'],
  },
};
```

Create `/public/og-image.png` — a 1200x630 branded card with the product name, tagline, and gradient background matching the site. Can be generated via the same Puppeteer pipeline used for the white paper, or designed as a static asset.

---

## Verification

- Resize browser to 375px width → verify ChatFeaturesSection stacks cleanly
- Resize browser to 375px width → verify FairComparisonSection cards are readable
- Use Chrome DevTools accessibility audit → verify all touch targets >= 44x44
- Check font sizes → no text below 12px on mobile
- Verify social proof strip renders with correct data
- Verify footer newsletter form submits (wired in Spec 2)
- Verify white paper form shows with "skip" link
- Share a page URL on Slack/Twitter → verify OG preview card appears
