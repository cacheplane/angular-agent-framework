# Website Audit — Mobile & Design Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four mobile layout/accessibility bugs and ship four design improvements (social proof, footer newsletter, white paper soft gate, OG tags) to increase credibility and lead capture.

**Architecture:** All changes are in existing React components (inline styles + Tailwind). Mobile breakpoints at 768px using either CSS media queries via `<style>` blocks or `useMediaQuery` hooks matching the existing HeroTwoCol pattern. The footer newsletter and white paper soft gate depend on Resend routes from the lead-generation plan.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, Framer Motion, design tokens

**Prerequisite:** Complete the lead-generation-resend plan first (Tasks 1-8) so `/api/newsletter` and the upgraded `/api/whitepaper-signup` exist.

---

### Task 1: Fix ChatFeaturesSection mobile overflow

**Files:**
- Modify: `apps/website/src/components/landing/ChatFeaturesSection.tsx`

- [ ] **Step 1: Add mobile detection**

The component already uses inline styles. Add a `useMediaQuery` hook or a CSS approach. Since HeroTwoCol uses a `<style>` tag with `@media`, follow that pattern. The main grid is on line 364:

```ts
style={{ display: 'grid', gridTemplateColumns: '1fr 440px 1fr', gap: '0 20px', maxWidth: 960, margin: '0 auto', alignItems: 'start' }}
```

Add a unique class to this grid div (e.g., `className="chat-features-grid"`) and add a `<style>` block inside the component's return:

```css
@media (max-width: 767px) {
  .chat-features-grid {
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    padding: 0 8px !important;
  }
  .chat-features-grid > div:nth-child(2) {
    width: 100% !important;
    max-width: 100% !important;
  }
  #feat-left, #feat-right {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
  }
}
```

- [ ] **Step 2: Verify at 375px width**

Resize browser to 375px. The chat window should be full-width. Left and right callout cards should appear below it in a wrapped row. No horizontal overflow.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/ChatFeaturesSection.tsx
git commit -m "fix: make ChatFeaturesSection responsive on mobile"
```

---

### Task 2: Fix FairComparisonSection mobile layout

**Files:**
- Modify: `apps/website/src/components/landing/FairComparisonSection.tsx`

- [ ] **Step 1: Add mobile stacked card layout**

The component uses a `gridTemplateColumns: '1fr 1fr 1fr'` grid for both header (line 99) and rows (line 123). Add a class to the container and use CSS media queries to stack on mobile.

Add `className="fair-compare-container"` to the glass card container div (line 81). Add `className="fair-compare-header"` to the header grid (line 98). Add `className="fair-compare-row"` to each row's motion.div (line 116).

Add this `<style>` block at the end of the component return (before the closing `</section>`):

```css
@media (max-width: 767px) {
  .fair-compare-header {
    display: none !important;
  }
  .fair-compare-row {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    padding: 16px 20px !important;
  }
  .fair-compare-row > div:nth-child(2)::before {
    content: 'Without: ';
    font-weight: 700;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.5;
  }
  .fair-compare-row > div:nth-child(3)::before {
    content: 'With ASR: ';
    font-weight: 700;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
}
```

Note: CSS `::before` pseudo-elements with `content` won't work on React elements rendered as children of a div. Instead, conditionally render inline labels. Use a `useEffect` + `matchMedia` approach or simply render both desktop and mobile labels and hide/show with Tailwind classes (`hidden md:grid` for header, `md:hidden` for mobile labels).

A cleaner approach: wrap each "Without" and "With" cell content in a span, and add a `<span className="md:hidden">` label before it. Hide the header row with `className="hidden md:grid"`.

- [ ] **Step 2: Implement the cleaner Tailwind approach**

Change the header row (line 98-113): Add `className="hidden md:grid"` to the header div and remove inline `display: 'grid'` (let the class control it):

```tsx
<div className="hidden md:grid" style={{
  gridTemplateColumns: '1fr 1fr 1fr',
  background: 'rgba(255,255,255,.3)',
  borderBottom: `1px solid ${tokens.glass.border}`,
  padding: '14px 24px',
}}>
```

For each row (line 116-144), change the grid div to use a class-based responsive layout:

```tsx
<motion.div
  key={row.capability}
  className="fair-compare-row"
  initial={{ opacity: 0, x: -8 }}
  whileInView={{ opacity: 1, x: 0 }}
  viewport={{ once: true }}
  transition={{ delay: i * 0.05, duration: 0.35 }}
  style={{
    padding: '14px 24px',
    borderBottom: i < ROWS.length - 1 ? `1px solid rgba(0,0,0,.05)` : 'none',
    alignItems: 'center',
  }}
>
```

Add a `<style>` block for the rows:

```css
.fair-compare-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
@media (max-width: 767px) {
  .fair-compare-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
}
```

For the "Without" and "With" cells, add mobile-only labels:

```tsx
{/* Without cell */}
<div style={{ fontSize: '0.8rem', color: tokens.colors.textMuted, paddingRight: 16, lineHeight: 1.5 }}>
  <span className="md:hidden" style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginRight: 6 }}>Without:</span>
  {row.without}
</div>

{/* With cell */}
<div style={{ fontSize: '0.8rem', color: tokens.colors.accent, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
  <span className="md:hidden" style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2 }}>With:</span>
  <span style={{ color: '#1a7a40', marginTop: 2, flexShrink: 0 }}>✓</span>
  <span style={{ fontFamily: row.with.startsWith('<') ? 'var(--font-mono,"JetBrains Mono",monospace)' : 'inherit', fontSize: row.with.startsWith('<') ? '0.72rem' : '0.8rem' }}>
    {row.with}
  </span>
</div>
```

- [ ] **Step 3: Verify at 375px width**

Each capability row should show as a stacked card: capability name, then "Without: ..." line, then "With: ✓ ..." line. Readable without horizontal scrolling.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/FairComparisonSection.tsx
git commit -m "fix: stack FairComparisonSection rows vertically on mobile"
```

---

### Task 3: Fix touch target sizes

**Files:**
- Modify: `apps/website/src/components/landing/CitationBadge.tsx`
- Modify: `apps/website/src/components/shared/Nav.tsx`
- Modify: `apps/website/src/components/shared/Footer.tsx`

- [ ] **Step 1: Fix CitationBadge touch target**

In `CitationBadge.tsx`, the button (line 44-68) is `width: 13, height: 13`. Keep the visual size but add a larger touch area. Wrap the button styling to add `minWidth: 44, minHeight: 44` while keeping the icon centered. Change the button style:

```ts
style={{
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'transparent',
  border: 'none',
  color: open ? 'rgba(0,64,144,0.7)' : 'rgba(0,64,144,0.35)',
  fontSize: 7,
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  padding: 0,
  transition: 'color 0.15s ease',
  flexShrink: 0,
  margin: '-15px -15px', // negative margin keeps visual spacing while enlarging hit area
}}
```

Add an inner span for the visual circle:

```tsx
<button ...>
  <span style={{
    width: 13, height: 13, borderRadius: '50%',
    border: `1px solid ${open ? 'rgba(0,64,144,0.45)' : 'rgba(0,64,144,0.2)'}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color 0.15s ease',
  }}>
    i
  </span>
</button>
```

- [ ] **Step 2: Fix Nav hamburger touch target**

In `Nav.tsx`, find the hamburger button. Add `minWidth: 44, minHeight: 44` and center the icon with flex. The visual icon stays the same size.

- [ ] **Step 3: Fix Footer social icon touch targets**

In `Footer.tsx`, the GitHub and npm links (line ~53-70) use 18x18 SVGs. Add `style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}` to each `<a>` tag.

- [ ] **Step 4: Verify touch targets**

Use Chrome DevTools → Rendering → Show Accessibility Inspector. Verify all interactive elements have touch targets >= 44x44px.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/CitationBadge.tsx apps/website/src/components/shared/Nav.tsx apps/website/src/components/shared/Footer.tsx
git commit -m "fix: increase touch targets to meet WCAG 44px minimum"
```

---

### Task 4: Fix sub-12px text on mobile

**Files:**
- Modify: `apps/website/src/components/landing/StatsStrip.tsx`
- Modify: `apps/website/src/components/landing/ProblemSection.tsx`

- [ ] **Step 1: Fix StatsStrip label font size**

In `StatsStrip.tsx`, the stat label (line 32-34) uses `fontSize: '0.9rem'` which is ~14.4px — fine. The value (line 27-31) uses `clamp(28px, 3vw, 40px)` — fine. No change needed here after checking.

- [ ] **Step 2: Fix ProblemSection progress bar labels**

In `ProblemSection.tsx`, the monospace labels use small sizes:
- "Project kickoff" label (line 226): `fontSize: '0.68rem'` = ~10.9px — change to `fontSize: 'max(12px, 0.68rem)'`
- "Teams stall here" label (line 231): same fix
- "Production" label (line 239): same fix
- Stall pin "50% abandon here" (line 298): `fontSize: '0.6rem'` = ~9.6px — change to `fontSize: 'max(12px, 0.6rem)'`
- Counter (line 307): `fontSize: '0.78rem'` = ~12.5px — fine

Apply `fontSize: 'max(12px, 0.68rem)'` to the three label spans and `fontSize: 'max(12px, 0.6rem)'` to the stall pin label.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/ProblemSection.tsx
git commit -m "fix: enforce 12px minimum font size on progress bar labels"
```

---

### Task 5: Add social proof strip

**Files:**
- Create: `apps/website/src/components/landing/SocialProof.tsx`
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Create the SocialProof component**

Create `apps/website/src/components/landing/SocialProof.tsx`:

```tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const BADGES = [
  { icon: '★', label: 'GitHub Stars', value: 'Open Source' },
  { icon: '↓', label: 'npm', value: '@cacheplane/langgraph' },
  { icon: '⚖', label: 'License', value: 'Source Available' },
];

export function SocialProof() {
  return (
    <section className="px-8 py-6 max-w-3xl mx-auto">
      <motion.div
        className="flex flex-wrap justify-center gap-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {BADGES.map((badge) => (
          <div
            key={badge.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 20,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              color: tokens.colors.textSecondary,
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>{badge.icon}</span>
            <span>{badge.value}</span>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Add to page.tsx**

In `apps/website/src/app/page.tsx`, add import and place after `<StatsStrip />`:

```tsx
import { SocialProof } from '../components/landing/SocialProof';
```

Insert between StatsStrip and ProblemSection:

```tsx
<StatsStrip />
<SocialProof />
<ProblemSection />
```

- [ ] **Step 3: Verify**

Check desktop and mobile. Should be a compact horizontal strip of badges.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/SocialProof.tsx apps/website/src/app/page.tsx
git commit -m "feat: add social proof badge strip below stats"
```

---

### Task 6: Add footer newsletter signup

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx`

- [ ] **Step 1: Add newsletter form to Footer**

In `Footer.tsx`, after the tagline paragraph (line ~43) and before the social links div (line ~46), add:

```tsx
{/* Newsletter signup */}
<NewsletterForm />
```

Add the `NewsletterForm` as a local component at the top of the file (after imports):

```tsx
function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState('submitting');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setState('done');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return <p className="text-sm mb-4" style={{ color: '#1a7a40' }}>✓ You're subscribed!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4 max-w-xs">
      <label htmlFor="footer-email" className="sr-only">Email address</label>
      <input
        id="footer-email"
        type="email"
        placeholder="Email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        disabled={state === 'submitting'}
        className="text-sm rounded-lg px-3 py-2 flex-1"
        style={{
          background: 'rgba(255,255,255,0.7)',
          border: `1px solid ${tokens.glass.border}`,
          color: tokens.colors.textPrimary,
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={state === 'submitting' || !email}
        className="text-xs font-mono font-bold uppercase tracking-wider rounded-lg px-4 py-2"
        style={{
          background: tokens.colors.accent,
          color: '#fff',
          border: 'none',
          cursor: email ? 'pointer' : 'not-allowed',
          opacity: email ? 1 : 0.5,
        }}
      >
        {state === 'submitting' ? '...' : 'Subscribe'}
      </button>
    </form>
  );
}
```

Add `useState` to the imports at the top of Footer.tsx:

```tsx
import { useState } from 'react';
```

- [ ] **Step 2: Verify**

Test the form: enter email → submit → "You're subscribed!" appears. Check Resend dashboard for welcome email.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "feat: add newsletter signup form to footer"
```

---

### Task 7: Restructure WhitePaperSection with soft gate

**Files:**
- Modify: `apps/website/src/components/landing/WhitePaperSection.tsx`

- [ ] **Step 1: Swap columns — form primary, download as skip link**

In `WhitePaperSection.tsx`, restructure the two-column grid:

**Left column (was download CTA, now form):** Move the form to the left column. Change the eyebrow from "Optional — Get notified of updates" to "Get the Guide". Change the submit button text from "Notify me" to "Send me the guide". Change the success message to "Check your inbox — the guide is on its way!".

**Right column (was form, now value prop):** Move the download CTA content (headline, description) to the right column. Replace the "Download PDF" button with the value prop description text.

**Skip link:** Below the form in the left column, add:

```tsx
<a
  href="/whitepaper.pdf"
  download="angular-agent-readiness-guide.pdf"
  style={{
    display: 'inline-block',
    marginTop: 12,
    fontSize: '0.75rem',
    color: tokens.colors.textMuted,
    textDecoration: 'underline',
    fontFamily: 'Inter, sans-serif',
  }}
>
  or download directly
</a>
```

- [ ] **Step 2: Verify**

1. Form is on the left, value prop on the right
2. Submit form → success message appears
3. "or download directly" link downloads the PDF without form
4. Check email inbox for the download link email

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/WhitePaperSection.tsx
git commit -m "feat: restructure white paper section with soft gate"
```

---

### Task 8: Add OG/meta tags and social image

**Files:**
- Modify: `apps/website/src/app/layout.tsx`
- Create: `apps/website/public/og-image.png` (or generate via script)

- [ ] **Step 1: Update metadata in layout.tsx**

In `apps/website/src/app/layout.tsx`, update the `metadata` export (line 24-27):

```ts
export const metadata: Metadata = {
  title: 'Angular Agent Framework — Signal-Native Streaming for Angular + LangGraph',
  description: 'The Enterprise Streaming Resource for LangChain and Angular. Signal-native streaming, thread persistence, and production patterns for Angular 20+.',
  openGraph: {
    title: 'Angular Agent Framework',
    description: 'Signal-native streaming for LangGraph — production patterns your Angular team can own.',
    images: ['/og-image.png'],
    type: 'website',
    siteName: 'Angular Agent Framework',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Angular Agent Framework',
    description: 'Signal-native streaming for LangGraph — production patterns your Angular team can own.',
    images: ['/og-image.png'],
  },
};
```

- [ ] **Step 2: Create OG image**

Create a simple OG image (1200x630) using the existing Puppeteer pipeline or a static design. The image should show:
- "Angular Agent Framework" in EB Garamond
- Tagline in Inter
- Gradient background matching the site (`tokens.gradient.bgFlow`)

A quick approach — create a script `apps/website/scripts/generate-og-image.ts` that renders HTML to PNG via Puppeteer (same pattern as `generate-whitepaper.ts`). Or create a static PNG manually and place it at `apps/website/public/og-image.png`.

- [ ] **Step 3: Verify**

Use https://www.opengraph.xyz/ or the Twitter Card Validator to preview how the URL will appear when shared. The OG image, title, and description should all render.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/layout.tsx apps/website/public/og-image.png
git commit -m "feat: add OpenGraph and Twitter Card meta tags with social image"
```

---

### Task 9: Final verification

- [ ] **Step 1: Mobile audit at 375px**

Resize browser to 375px width. Scroll through the entire page:
- ChatFeaturesSection: no overflow, single column
- FairComparisonSection: stacked cards, readable
- Touch targets: all >= 44px
- No text below 12px

- [ ] **Step 2: Desktop audit at 1440px**

Verify nothing is broken on desktop — all sections should render exactly as before.

- [ ] **Step 3: Test all forms end-to-end**

1. Footer newsletter → subscribe → welcome email received
2. White paper soft gate → submit → download email received
3. White paper "skip" link → PDF downloads
4. Pricing lead form → submit → notification email received

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
