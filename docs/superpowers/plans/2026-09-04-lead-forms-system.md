# Lead Forms System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five hand-rolled lead forms on threadplane.ai with one form kit and one submission hook, composed into four surfaces, so every form looks, behaves, and reads the same and the footer newsletter's collapsed input is fixed structurally.

**Architecture:** A `components/form/` kit (Field, TextInput, TextArea, Select, FormCard, SubmitButton, FormStatus) plus a `useGrowthForm` hook that owns the growth envelope, the stale-policy branch, analytics, and the status machine. Styling lives in one new `styles/forms.css` guarded by the style-contract test. The enterprise form merges into `/contact?intent=enterprise`; `/pricing` keeps a CTA band. Whitepaper block and toast keep their compositions and swap their inputs for kit pieces.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Vitest + Testing Library (jsdom), Playwright, CSS custom properties from `@threadplane/design-tokens`, Nx.

**Spec:** `docs/superpowers/specs/2026-09-03-lead-forms-system-design.md`

**Branch:** create from `origin/main` with `git fetch origin main && git checkout -b blove/lead-forms-kit origin/main` (see memory: never branch from stale local main). Run `npm ci` once in a fresh worktree before anything else.

**Ships as three PRs**, each leaving every surface working because each merge auto-promotes production:

| PR | Tasks | Delivers |
|---|---|---|
| 1 | 1–9 | Form kit, `forms.css`, hook, footer newsletter on the kit (fixes the live bug) |
| 2 | 10–13 | Contact page with the enterprise variant, pricing CTA band, `LeadForm` deleted |
| 3 | 14–16 | Whitepaper block and toast on the kit, old form CSS deleted |

**Commands used throughout** (run from the repo root):

```bash
# unit tests for one file
npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/Field.spec.tsx
# whole website unit suite
npx nx test website --skip-nx-cache
# lint
npx nx lint website --skip-nx-cache
# production build (catches type errors the tests do not)
npx nx build website --skip-nx-cache
```

---

## File structure

**Create**

| File | Responsibility |
|---|---|
| `apps/website/src/styles/forms.css` | Every form-kit rule: tokens, controls, card, submit, status, layout helpers. Imported once from `global.css`. |
| `apps/website/src/components/form/field-context.ts` | Context carrying the control id, described-by ids, and invalid flag from `Field` to its control. |
| `apps/website/src/components/form/Field.tsx` (+ `.spec.tsx`) | Label, optional marker, help, error; wires `aria-describedby` and `aria-invalid`. |
| `apps/website/src/components/form/controls.tsx` (+ `controls.spec.tsx`) | `TextInput`, `TextArea`, `Select`: thin wrappers reading the field context. |
| `apps/website/src/components/form/FormCard.tsx` (+ `.spec.tsx`) | The elevated card; `compact` prop. |
| `apps/website/src/components/form/SubmitButton.tsx` (+ `.spec.tsx`) | `Button` with a width-stable `pending` state. |
| `apps/website/src/components/form/FormStatus.tsx` (+ `.spec.tsx`) | Success / failure / stale blocks with the right ARIA role. |
| `apps/website/src/components/form/validators.ts` (+ `.spec.ts`) | `emailError`, `requiredError`: pure functions returning error copy or `null`. |
| `apps/website/src/components/form/use-growth-form.ts` (+ `.spec.tsx`) | The shared submission hook. |
| `apps/website/src/components/form/index.ts` | Barrel. |
| `apps/website/src/components/pricing/EnterpriseCtaBand.tsx` (+ `.spec.tsx`) | Replaces `LeadForm` on `/pricing`. |

**Modify**

| File | Change |
|---|---|
| `apps/website/src/app/global.css` | `@import "../styles/forms.css";` after `marketing.css`. |
| `apps/website/src/styles/style-contracts.spec.ts` | Four contracts for `forms.css`. |
| `apps/website/src/lib/analytics/events.ts` | Add `entry_point?: string` to `AnalyticsProperties` (documented; the index signature already admits it). |
| `apps/website/src/components/shared/Footer.tsx` (+ `.spec.tsx`) | `NewsletterForm` on the kit. |
| `apps/website/src/components/contact/ContactForm.tsx` (+ `.spec.tsx`) | Rebuilt on the kit with `intent` prop. |
| `apps/website/src/app/contact/page.tsx` | Band layout; reads `intent` from `searchParams`. |
| `apps/website/src/components/pricing/CompareTable.tsx` | CTA hrefs to `/contact?intent=enterprise&entry=…`. |
| `apps/website/src/app/pricing/page.tsx` | `EnterpriseCtaBand` replaces `LeadForm`. |
| `apps/website/src/components/landing/WhitePaperBlock.tsx` (+ `.spec.tsx`) | Form parts on the kit. |
| `apps/website/src/components/shared/AnnouncementToast.tsx` (+ `.spec.tsx`) | Form parts on the kit. |
| `apps/website/src/styles/marketing.css`, `landing.css`, `chrome.css`, `pages.css` | Old form rules removed; contact band rules added to `pages.css`. |
| `apps/website/e2e/website.spec.ts` | Form-flow cases rewritten; enterprise-intent and footer-width cases added. |

**Delete**

`apps/website/src/components/pricing/LeadForm.tsx`, `LeadForm.spec.tsx`, `apps/website/src/components/contact/SlaCard.tsx` (its copy moves into the band), and the `.lead-form-*`, `.contact-form-*`, `.wp-form`/`.wp-email-input`/`.wp-disclosure`/`.wp-error*`/`.wp-success*`/`.wp-already*`, `.footer-newsletter-*`, `.toast-input`/`.toast-disclosure`/`.toast-download-link`/`.toast-success-text` rules.

---

## Task 1: `forms.css`, tokens, import, and style contracts

**Files:**
- Create: `apps/website/src/styles/forms.css`
- Modify: `apps/website/src/app/global.css:16`
- Modify: `apps/website/src/styles/style-contracts.spec.ts`

- [ ] **Step 1: Write the failing style-contract tests**

Append these entries to the `CONTRACTS` array in `apps/website/src/styles/style-contracts.spec.ts`, before the closing `];`:

```ts
  {
    file: 'forms.css',
    selector: '[data-ui="form-control"]',
    why: 'Every form control shares one height and one focus ring. If either goes, inputs silently drift back to five sizes and lose keyboard visibility.',
    requires: {
      height: /height:\s*var\(--form-control-height\)/,
    },
  },
  {
    file: 'forms.css',
    selector: '[data-ui="form-control"]:focus-visible',
    why: 'WCAG 2.2 focus appearance. Without this ring keyboard users cannot see which field is active.',
    requires: {
      'box-shadow': /box-shadow:\s*var\(--form-focus-ring\)/,
    },
  },
  {
    file: 'forms.css',
    selector: '[data-ui="form-control"][aria-invalid="true"]',
    why: 'Errors are text plus a ring. Losing the ring leaves the icon-and-text line as the only cue, which reads as help text at a glance.',
    requires: {
      'box-shadow': /box-shadow:\s*var\(--form-error-ring\)/,
    },
  },
  {
    file: 'forms.css',
    selector: '[data-ui="form-row"]',
    why: 'The footer newsletter row once put its disclosure inside the flex row and the input collapsed to 26px. The row must only ever hold controls.',
    requires: {
      display: /display:\s*flex/,
      gap: /gap:/,
    },
  },
```

- [ ] **Step 2: Run the contract spec to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/styles/style-contracts.spec.ts`
Expected: FAIL, four new cases, each with "ENOENT" or "missing declaration" for `forms.css`.

- [ ] **Step 3: Create `forms.css`**

```css
/*
 * Lead-form kit. Every form on the marketing site composes these rules.
 * Spec: docs/superpowers/specs/2026-09-03-lead-forms-system-design.md
 *
 * Tokens below are website-scoped and derive from @threadplane/design-tokens.
 * They are the only place a form size, ring, or status color is defined.
 */
:root {
  --form-control-height: 44px;
  --form-control-height-compact: 36px;
  --form-control-radius: 8px;
  --form-focus-ring: 0 0 0 3px var(--color-accent-glow);
  --form-error-ring: 0 0 0 3px rgba(221, 0, 49, 0.18);
  --color-status-success: #1a7a40;
  --color-status-error: var(--color-angular-red);
}

/* Field: label, control, help, error */
[data-ui="field"] {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-ui="field-label"] {
  font-family: var(--font-inter);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}
[data-ui="field-optional"] {
  font-weight: 400;
  color: var(--color-text-muted);
}
[data-ui="field-help"] {
  margin: 0;
  font-family: var(--font-inter);
  font-size: 12px;
  color: var(--color-text-muted);
}
[data-ui="field-error"] {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-family: var(--font-inter);
  font-size: 12px;
  color: var(--color-status-error);
}
[data-ui="field-error"]::before {
  content: "!";
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-status-error);
  color: var(--color-text-inverted);
  font-size: 10px;
  font-weight: 700;
}

/* Controls */
[data-ui="form-control"] {
  display: block;
  width: 100%;
  box-sizing: border-box;
  height: var(--form-control-height);
  padding: 0 14px;
  font-family: var(--font-inter);
  font-size: var(--text-body);
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--form-control-radius);
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
[data-ui="form-control"]::placeholder {
  color: var(--color-text-muted);
}
[data-ui="form-control"][data-multiline] {
  height: auto;
  min-height: calc(var(--form-control-height) * 2.4);
  padding: 11px 14px;
  resize: vertical;
  line-height: var(--text-body--line-height);
}
[data-ui="form-control"][data-compact] {
  height: var(--form-control-height-compact);
  padding: 0 12px;
  font-size: 14px;
}
[data-ui="form-control"]:focus-visible {
  border-color: var(--color-accent);
  box-shadow: var(--form-focus-ring);
}
[data-ui="form-control"][aria-invalid="true"] {
  border-color: var(--color-status-error);
  box-shadow: var(--form-error-ring);
}
[data-ui="form-control"]:disabled {
  color: var(--color-text-muted);
  background: var(--color-surface-dim);
}
select[data-ui="form-control"] {
  appearance: none;
  padding-right: 36px;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%23737373' stroke-width='1.5'/></svg>");
  background-repeat: no-repeat;
  background-position: right 14px center;
}

/* Layout helpers */
[data-ui="form"] {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
[data-ui="form"][data-compact] {
  gap: 10px;
}
[data-ui="form-row"] {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
[data-ui="form-row"] > [data-ui="field"] {
  flex: 1 1 200px;
  min-width: 0;
}
[data-ui="form-disclosure"] {
  margin: 0;
  font-family: var(--font-inter);
  font-size: 12px;
  line-height: 1.45;
  color: var(--color-text-muted);
}

/* Card */
[data-ui="form-card"] {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-lg);
}
[data-ui="form-card"][data-compact] {
  padding: 18px;
  box-shadow: var(--shadow-md);
}

/* Submit: both labels occupy the same grid cell so the width never changes */
[data-ui="submit"] > span:first-child {
  display: inline-grid;
}
[data-ui="submit"] [data-slot] {
  grid-area: 1 / 1;
  white-space: nowrap;
}
[data-ui="submit"]:not([data-pending]) [data-slot="pending"],
[data-ui="submit"][data-pending] [data-slot="label"] {
  visibility: hidden;
}

/* Status blocks */
[data-ui="form-status"] {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: var(--form-control-radius);
  font-family: var(--font-inter);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  background: var(--color-surface-tinted);
}
[data-ui="form-status"][data-tone="success"] {
  border-color: var(--color-accent-border);
  background: var(--color-accent-surface);
}
[data-ui="form-status"][data-tone="failure"] {
  border-color: rgba(221, 0, 49, 0.25);
  background: rgba(221, 0, 49, 0.05);
}
[data-ui="form-status-icon"] {
  flex: 0 0 auto;
  font-weight: 700;
}
[data-ui="form-status"][data-tone="success"] [data-ui="form-status-icon"] {
  color: var(--color-status-success);
}
[data-ui="form-status"][data-tone="failure"] [data-ui="form-status-icon"] {
  color: var(--color-status-error);
}
[data-ui="form-status-body"] {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
[data-ui="form-status-body"] p {
  margin: 0;
}
[data-ui="form-status"] a {
  color: var(--color-accent);
}

@media (prefers-reduced-motion: reduce) {
  [data-ui="form-control"] {
    transition: none;
  }
}
```

- [ ] **Step 4: Import it**

In `apps/website/src/app/global.css`, after line 16 (`@import "../styles/marketing.css";`) add:

```css
@import "../styles/forms.css";
```

- [ ] **Step 5: Run the contract spec to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/styles/style-contracts.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/styles/forms.css apps/website/src/app/global.css apps/website/src/styles/style-contracts.spec.ts
git commit -m "feat(website): add the lead-form stylesheet and its style contracts"
```

---

## Task 2: `Field` and the field context

**Files:**
- Create: `apps/website/src/components/form/field-context.ts`
- Create: `apps/website/src/components/form/Field.tsx`
- Test: `apps/website/src/components/form/Field.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import React, { useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';
import { FieldContext } from './field-context';

function Probe() {
  const ctx = useContext(FieldContext);
  return <input data-testid="probe" id={ctx?.id} aria-describedby={ctx?.describedBy} aria-invalid={ctx?.invalid || undefined} />;
}

describe('Field', () => {
  it('labels the control by id and marks optional fields', () => {
    render(
      <Field id="f-email" label="Work email" optional>
        <Probe />
      </Field>
    );
    const label = screen.getByText('Work email', { selector: 'label' });
    expect(label.getAttribute('for')).toBe('f-email');
    expect(screen.getByText('(optional)')).toBeTruthy();
    expect(screen.getByTestId('probe').id).toBe('f-email');
  });

  it('wires help and error text through aria-describedby and sets aria-invalid', () => {
    render(
      <Field id="f-email" label="Work email" help="We reply from a real inbox." error="Enter a full address, like jordan@acme.dev.">
        <Probe />
      </Field>
    );
    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('aria-describedby')).toBe('f-email-help f-email-error');
    expect(probe.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a full address, like jordan@acme.dev.').id).toBe('f-email-error');
    expect(screen.getByText('We reply from a real inbox.').id).toBe('f-email-help');
  });

  it('omits aria-describedby when there is nothing to describe', () => {
    render(
      <Field id="f-name" label="Name">
        <Probe />
      </Field>
    );
    expect(screen.getByTestId('probe').getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByTestId('probe').getAttribute('aria-invalid')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/Field.spec.tsx`
Expected: FAIL, "Cannot find module './Field'".

- [ ] **Step 3: Write the context**

`apps/website/src/components/form/field-context.ts`:

```ts
import { createContext } from 'react';

export interface FieldControlContext {
  /** id the label points at; the control must render it as its id. */
  id: string;
  /** Space-separated ids of help and error text, or undefined when neither exists. */
  describedBy: string | undefined;
  /** True while the field shows an error. */
  invalid: boolean;
}

export const FieldContext = createContext<FieldControlContext | null>(null);
```

- [ ] **Step 4: Write `Field`**

`apps/website/src/components/form/Field.tsx`:

```tsx
import type { ReactNode } from 'react';
import { FieldContext } from './field-context';

interface FieldProps {
  /** Control id. The label's `for` and the control's `id` both use it. */
  id: string;
  label: ReactNode;
  optional?: boolean;
  help?: ReactNode;
  /** Error copy. Present means the field is invalid. */
  error?: string | null;
  children: ReactNode;
}

export function Field({ id, label, optional = false, help, error, children }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div data-ui="field">
      <label data-ui="field-label" htmlFor={id}>
        {label}
        {optional ? <> <span data-ui="field-optional">(optional)</span></> : null}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {help ? (
        <p data-ui="field-help" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p data-ui="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/Field.spec.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/form/field-context.ts apps/website/src/components/form/Field.tsx apps/website/src/components/form/Field.spec.tsx
git commit -m "feat(website): add the form Field primitive with wired accessibility"
```

---

## Task 3: `TextInput`, `TextArea`, `Select`

**Files:**
- Create: `apps/website/src/components/form/controls.tsx`
- Test: `apps/website/src/components/form/controls.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';
import { Select, TextArea, TextInput } from './controls';

describe('form controls', () => {
  it('TextInput takes id, described-by, and invalid from the surrounding Field', () => {
    render(
      <Field id="c-email" label="Work email" error="Enter a full address, like jordan@acme.dev.">
        <TextInput type="email" autoComplete="email" />
      </Field>
    );
    const input = screen.getByLabelText('Work email') as HTMLInputElement;
    expect(input.id).toBe('c-email');
    expect(input.getAttribute('data-ui')).toBe('form-control');
    expect(input.getAttribute('aria-describedby')).toBe('c-email-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.type).toBe('email');
    expect(input.autocomplete).toBe('email');
  });

  it('TextArea marks itself multiline and Select renders its options', () => {
    render(
      <>
        <Field id="c-msg" label="Message">
          <TextArea rows={3} />
        </Field>
        <Field id="c-when" label="Timeline">
          <Select defaultValue="">
            <option value="" disabled>Select…</option>
            <option value="this_quarter">This quarter</option>
          </Select>
        </Field>
      </>
    );
    expect(screen.getByLabelText('Message').getAttribute('data-multiline')).toBe('');
    expect(screen.getByLabelText('Timeline').tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'This quarter' })).toBeTruthy();
  });

  it('accepts a compact size', () => {
    render(
      <Field id="c-nl" label="Email">
        <TextInput compact />
      </Field>
    );
    expect(screen.getByLabelText('Email').getAttribute('data-compact')).toBe('');
  });

  it('works outside a Field when given an explicit id', () => {
    render(<TextInput id="lone" aria-label="Lone" />);
    expect(screen.getByLabelText('Lone').id).toBe('lone');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/controls.spec.tsx`
Expected: FAIL, "Cannot find module './controls'".

- [ ] **Step 3: Write the controls**

`apps/website/src/components/form/controls.tsx`:

```tsx
import { useContext } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { FieldContext } from './field-context';

interface ControlExtras {
  /** Shorter control for the toast and the footer. */
  compact?: boolean;
}

function useControlAttributes(compact: boolean, explicitId: string | undefined) {
  const field = useContext(FieldContext);
  return {
    id: explicitId ?? field?.id,
    'aria-describedby': field?.describedBy,
    'aria-invalid': field?.invalid ? true : undefined,
    'data-ui': 'form-control' as const,
    'data-compact': compact ? '' : undefined,
  };
}

export function TextInput({ compact = false, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & ControlExtras) {
  return <input {...useControlAttributes(compact, id)} {...rest} />;
}

export function TextArea({ compact = false, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlExtras) {
  return <textarea {...useControlAttributes(compact, id)} data-multiline="" {...rest} />;
}

export function Select({ compact = false, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & ControlExtras) {
  return (
    <select {...useControlAttributes(compact, id)} {...rest}>
      {children}
    </select>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/controls.spec.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/form/controls.tsx apps/website/src/components/form/controls.spec.tsx
git commit -m "feat(website): add TextInput, TextArea, and Select form controls"
```

---

## Task 4: `FormCard`, `SubmitButton`, `FormStatus`

**Files:**
- Create: `apps/website/src/components/form/FormCard.tsx`
- Create: `apps/website/src/components/form/SubmitButton.tsx`
- Create: `apps/website/src/components/form/FormStatus.tsx`
- Test: `apps/website/src/components/form/FormCard.spec.tsx`, `SubmitButton.spec.tsx`, `FormStatus.spec.tsx`

- [ ] **Step 1: Write the failing tests**

`FormCard.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FormCard } from './FormCard';

describe('FormCard', () => {
  it('renders the card shell and forwards the compact flag', () => {
    const { container, rerender } = render(<FormCard>body</FormCard>);
    const card = container.querySelector('[data-ui="form-card"]');
    expect(card?.textContent).toBe('body');
    expect(card?.getAttribute('data-compact')).toBeNull();
    rerender(<FormCard compact>body</FormCard>);
    expect(container.querySelector('[data-ui="form-card"]')?.getAttribute('data-compact')).toBe('');
  });
});
```

`SubmitButton.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubmitButton } from './SubmitButton';

describe('SubmitButton', () => {
  it('renders both labels so width is stable, exposes only the active one, and disables while pending', () => {
    const { rerender } = render(<SubmitButton pendingLabel="Sending…">Send to Brian</SubmitButton>);
    const button = screen.getByRole('button', { name: 'Send to Brian' }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('data-pending')).toBeNull();
    expect(button.querySelector('[data-slot="pending"]')?.textContent).toBe('Sending…');

    rerender(<SubmitButton pending pendingLabel="Sending…">Send to Brian</SubmitButton>);
    const pending = screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    expect(pending.getAttribute('data-pending')).toBe('');
    expect(pending.getAttribute('aria-busy')).toBe('true');
  });
});
```

`FormStatus.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormStatus } from './FormStatus';

describe('FormStatus', () => {
  it('announces success politely', () => {
    render(<FormStatus tone="success" title="Sent." detail="Expect a reply within one business day." />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('data-tone')).toBe('success');
    expect(status.textContent).toContain('Sent.');
    expect(status.textContent).toContain('Expect a reply within one business day.');
  });

  it('announces failure and stale as alerts and renders an action', () => {
    render(
      <FormStatus tone="failure" title="That did not send." detail="Email brian@threadplane.ai instead.">
        <a href="/whitepaper.pdf">Download the PDF directly</a>
      </FormStatus>
    );
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('data-tone')).toBe('failure');
    expect(screen.getByRole('link', { name: 'Download the PDF directly' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/FormCard.spec.tsx apps/website/src/components/form/SubmitButton.spec.tsx apps/website/src/components/form/FormStatus.spec.tsx`
Expected: FAIL, three "Cannot find module" errors.

- [ ] **Step 3: Write the three components**

`FormCard.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react';

interface FormCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  compact?: boolean;
}

export function FormCard({ children, compact = false, ...rest }: FormCardProps) {
  return (
    <div data-ui="form-card" data-compact={compact ? '' : undefined} {...rest}>
      {children}
    </div>
  );
}
```

`SubmitButton.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '../ui/Button';

type SubmitButtonProps = Omit<Extract<ButtonProps, { href?: undefined }>, 'type' | 'children'> & {
  children: ReactNode;
  pending?: boolean;
  pendingLabel: string;
};

/**
 * Both labels render in the same grid cell (see forms.css) so the button
 * keeps its width when the label swaps. The inactive label is hidden from
 * layout by visibility and from assistive tech by aria-hidden.
 */
export function SubmitButton({ children, pending = false, pendingLabel, disabled, ...rest }: SubmitButtonProps) {
  return (
    <Button
      {...rest}
      type="submit"
      data-ui="submit"
      data-pending={pending ? '' : undefined}
      aria-busy={pending || undefined}
      disabled={pending || disabled}
    >
      <span data-slot="label" aria-hidden={pending || undefined}>{children}</span>
      <span data-slot="pending" aria-hidden={!pending || undefined}>{pendingLabel}</span>
    </Button>
  );
}
```

Note: `Button` sets `type="button"` before spreading `buttonAttrs`, so the explicit `type="submit"` here wins; `data-ui="submit"` is spread after `data-ui="button"` for the same reason. Verify by reading `apps/website/src/components/ui/Button.tsx:78-90`.

`FormStatus.tsx`:

```tsx
import type { ReactNode } from 'react';

type Tone = 'success' | 'failure' | 'stale';

interface FormStatusProps {
  tone: Tone;
  title: string;
  detail?: ReactNode;
  /** Optional follow-up: a link, a retry button, a refresh button. */
  children?: ReactNode;
}

const ICON: Record<Tone, string> = { success: '✓', failure: '!', stale: '↻' };

export function FormStatus({ tone, title, detail, children }: FormStatusProps) {
  const role = tone === 'success' ? 'status' : 'alert';
  return (
    <div data-ui="form-status" data-tone={tone} role={role}>
      <span data-ui="form-status-icon" aria-hidden="true">{ICON[tone]}</span>
      <div data-ui="form-status-body">
        <p>
          <strong>{title}</strong>
          {detail ? <> {detail}</> : null}
        </p>
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/`
Expected: PASS, all form specs so far.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/form/FormCard.tsx apps/website/src/components/form/SubmitButton.tsx apps/website/src/components/form/FormStatus.tsx apps/website/src/components/form/FormCard.spec.tsx apps/website/src/components/form/SubmitButton.spec.tsx apps/website/src/components/form/FormStatus.spec.tsx
git commit -m "feat(website): add FormCard, SubmitButton, and FormStatus"
```

---

## Task 5: Validators

**Files:**
- Create: `apps/website/src/components/form/validators.ts`
- Test: `apps/website/src/components/form/validators.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { emailError, requiredError } from './validators';

describe('validators', () => {
  it('emailError names the fix and accepts a full address', () => {
    expect(emailError('')).toBe('Enter your email address.');
    expect(emailError('jordan@acme')).toBe('Enter a full address, like jordan@acme.dev.');
    expect(emailError('jordan@acme.dev')).toBeNull();
    expect(emailError('  jordan@acme.dev ')).toBeNull();
  });

  it('requiredError uses the supplied message only when the value is blank', () => {
    expect(requiredError('', 'Choose a timeline so we can route this.')).toBe('Choose a timeline so we can route this.');
    expect(requiredError('   ', 'Choose a timeline so we can route this.')).toBe('Choose a timeline so we can route this.');
    expect(requiredError('this_quarter', 'Choose a timeline so we can route this.')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/validators.spec.ts`
Expected: FAIL, "Cannot find module './validators'".

- [ ] **Step 3: Write the validators**

```ts
/** Loose shape check: something@something.tld. The server normalizes for real. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Enter your email address.';
  if (!EMAIL_SHAPE.test(trimmed)) return 'Enter a full address, like jordan@acme.dev.';
  return null;
}

export function requiredError(value: string, message: string): string | null {
  return value.trim().length === 0 ? message : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/validators.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/form/validators.ts apps/website/src/components/form/validators.spec.ts
git commit -m "feat(website): add form validators with fix-naming error copy"
```

---

## Task 6: `useGrowthForm`

**Files:**
- Create: `apps/website/src/components/form/use-growth-form.ts`
- Modify: `apps/website/src/lib/analytics/events.ts` (add `entry_point?: string;` to `AnalyticsProperties`, after `error_reason?: string;`)
- Test: `apps/website/src/components/form/use-growth-form.spec.tsx`

The hook reproduces exactly the flow every surface copies today (compare `apps/website/src/components/contact/ContactForm.tsx:29-88`): snapshot reuse across retries, POST of the envelope, 409 = stale, any 4xx clears the snapshot, ok = success, other = fail `api_error`, thrown = fail `network_error`.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));

import { analyticsEvents } from '../../lib/analytics/events';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { useGrowthForm } from './use-growth-form';

const formPolicy: PublicFormPolicy = {
  mode: 'growth_v1',
  version: 'growth_v1.2026-09-01',
  disclosures: { contact: 'c', newsletter: 'n', whitepaper: 'w' },
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function options() {
  return {
    route: '/api/leads' as const,
    formPolicy,
    events: {
      submit: analyticsEvents.marketingLeadFormSubmit,
      success: analyticsEvents.marketingLeadFormSuccess,
      fail: analyticsEvents.marketingLeadFormFail,
    },
    analytics: { surface: 'contact' as const, source_section: 'contact-form' },
  };
}

function body(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

beforeEach(() => {
  trackMock.mockClear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('useGrowthForm', () => {
  it('posts the growth envelope, fires submit then success, and lands on sent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGrowthForm(options()));
    expect(result.current.status).toBe('idle');

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/leads', expect.objectContaining({ method: 'POST' }));
    const sent = body(fetchMock, 0);
    expect(sent).toMatchObject({ form_kind: 'contact', email: 'jane@acme.com', policy_version: 'growth_v1.2026-09-01' });
    expect(sent.submission_id).toMatch(UUID_V4);
    expect(trackMock).toHaveBeenNthCalledWith(1, 'marketing:lead_form_submit', { surface: 'contact', source_section: 'contact-form' });
    expect(trackMock).toHaveBeenNthCalledWith(2, 'marketing:lead_form_success', { surface: 'contact', source_section: 'contact-form' });
    expect(result.current.status).toBe('sent');
  });

  it('reuses the submission id when the same facts are retried after a server error, then fails with api_error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));
    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(body(fetchMock, 0).submission_id).toBe(body(fetchMock, 1).submission_id);
    expect(result.current.status).toBe('failed');
    expect(trackMock).toHaveBeenLastCalledWith('marketing:lead_form_fail', expect.objectContaining({ error_reason: 'api_error' }));
  });

  it('mints a new submission id when the facts change', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));
    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.dev' }));

    expect(body(fetchMock, 0).submission_id).not.toBe(body(fetchMock, 1).submission_id);
  });

  it('goes stale on 409 and reports no success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(result.current.status).toBe('stale');
    expect(trackMock).not.toHaveBeenCalledWith('marketing:lead_form_success', expect.anything());
  });

  it('fails with network_error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { result } = renderHook(() => useGrowthForm(options()));

    await act(() => result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }));

    expect(result.current.status).toBe('failed');
    expect(trackMock).toHaveBeenLastCalledWith('marketing:lead_form_fail', expect.objectContaining({ error_reason: 'network_error' }));
  });

  it('is pending while the request is in flight and can be reset', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((r) => { resolve = r; })));
    const { result } = renderHook(() => useGrowthForm(options()));

    let done: Promise<void> = Promise.resolve();
    act(() => { done = result.current.submit({ form_kind: 'contact', email: 'jane@acme.com' }); });
    await waitFor(() => expect(result.current.status).toBe('pending'));

    await act(async () => { resolve({ ok: true, status: 200 }); await done; });
    expect(result.current.status).toBe('sent');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/use-growth-form.spec.tsx`
Expected: FAIL, "Cannot find module './use-growth-form'".

- [ ] **Step 3: Add `entry_point` to the analytics property type**

In `apps/website/src/lib/analytics/events.ts`, inside `AnalyticsProperties`, after `error_reason?: string;` add:

```ts
  /** Which CTA carried the visitor to a form; e.g. `pricing_tier_enterprise`. */
  entry_point?: string;
```

- [ ] **Step 4: Write the hook**

`apps/website/src/components/form/use-growth-form.ts`:

```ts
'use client';
import { useCallback, useRef, useState } from 'react';
import { track } from '../../lib/analytics/client';
import type { AnalyticsEventName, AnalyticsProperties } from '../../lib/analytics/events';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import {
  growthFormRequestSnapshot,
  type GrowthFormFacts,
  type GrowthFormRequestSnapshot,
} from '../../lib/growth/form-client';

export type GrowthFormStatus = 'idle' | 'pending' | 'sent' | 'failed' | 'stale';

export type GrowthFormRoute = '/api/leads' | '/api/newsletter' | '/api/whitepaper-signup';

export interface UseGrowthFormOptions {
  route: GrowthFormRoute;
  formPolicy: PublicFormPolicy;
  events: { submit: AnalyticsEventName; success: AnalyticsEventName; fail: AnalyticsEventName };
  /** Sent with every event: surface, source_section, paper, entry_point. */
  analytics: AnalyticsProperties;
}

export interface GrowthFormController<Facts extends GrowthFormFacts> {
  status: GrowthFormStatus;
  /** Posts the facts. Resolves after the status has settled; never throws. */
  submit: (facts: Facts) => Promise<void>;
  /** Back to idle; keeps the snapshot so a retry after reset still reuses its id. */
  reset: () => void;
}

/**
 * One implementation of the flow every lead surface used to copy:
 * immutable request snapshot, growth envelope, stale-policy branch, analytics.
 * 409 means the visitor's page holds an old policy version; any 4xx discards
 * the snapshot so the next attempt is a fresh submission.
 */
export function useGrowthForm<Facts extends GrowthFormFacts = GrowthFormFacts>(
  options: UseGrowthFormOptions
): GrowthFormController<Facts> {
  const { route, formPolicy, events, analytics } = options;
  const [status, setStatus] = useState<GrowthFormStatus>('idle');
  const snapshotRef = useRef<GrowthFormRequestSnapshot<Facts> | null>(null);

  const submit = useCallback(
    async (facts: Facts) => {
      setStatus('pending');
      track(events.submit, analytics);
      try {
        const snapshot = growthFormRequestSnapshot<Facts>(snapshotRef.current, facts);
        snapshotRef.current = snapshot;
        const response = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...snapshot.facts,
            acquisition_session_id: snapshot.acquisition_session_id,
            submission_id: snapshot.submission_id,
            policy_version: formPolicy.version,
          }),
        });
        if (response.status === 409) {
          snapshotRef.current = null;
          setStatus('stale');
          return;
        }
        if (response.status >= 400 && response.status < 500) {
          snapshotRef.current = null;
        }
        if (response.ok) {
          snapshotRef.current = null;
          track(events.success, analytics);
          setStatus('sent');
          return;
        }
        track(events.fail, { ...analytics, error_reason: 'api_error' });
        setStatus('failed');
      } catch {
        track(events.fail, { ...analytics, error_reason: 'network_error' });
        setStatus('failed');
      }
    },
    [route, formPolicy.version, events, analytics]
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, submit, reset };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/form/use-growth-form.spec.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Add the barrel**

`apps/website/src/components/form/index.ts`:

```ts
export { Field } from './Field';
export { TextInput, TextArea, Select } from './controls';
export { FormCard } from './FormCard';
export { SubmitButton } from './SubmitButton';
export { FormStatus } from './FormStatus';
export { emailError, requiredError } from './validators';
export { useGrowthForm } from './use-growth-form';
export type { GrowthFormStatus, GrowthFormController, UseGrowthFormOptions } from './use-growth-form';
```

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/form/use-growth-form.ts apps/website/src/components/form/use-growth-form.spec.tsx apps/website/src/components/form/index.ts apps/website/src/lib/analytics/events.ts
git commit -m "feat(website): add useGrowthForm, the shared lead-form submission hook"
```

---

## Task 7: Footer newsletter on the kit

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx:44-146` (the `NewsletterForm` function)
- Modify: `apps/website/src/components/shared/Footer.spec.tsx`
- Modify: `apps/website/src/styles/chrome.css` (delete `.footer-newsletter-success` and `.footer-newsletter-input`; add the layout rule below)

- [ ] **Step 1: Read the existing footer spec**

Open `apps/website/src/components/shared/Footer.spec.tsx`. Its five newsletter cases assert: the disclosure text and `aria-describedby` on the submit control; the envelope facts; submission-id reuse; a new id on changed facts; the stale refresh path. Keep every assertion. Change only the selectors listed in Step 2.

- [ ] **Step 2: Update the failing tests**

In `Footer.spec.tsx`, make these replacements:

- `screen.getByLabelText('Email address')` → `screen.getByLabelText('Email')`
- `screen.getByRole('button', { name: 'Subscribe' })` stays.
- Any assertion on `"✓ You're subscribed!"` → `screen.getByRole('status')` containing `'Subscribed.'`
- Add one new case inside `describe('Footer newsletter growth policy')`:

```tsx
  it('keeps the disclosure out of the control row and shows a fix-naming email error on blur', () => {
    render(<Footer formPolicy={formPolicy} />);
    const input = screen.getByLabelText('Email');
    const row = input.closest('[data-ui="form-row"]');
    expect(row).toBeTruthy();
    expect(row?.querySelector('[data-ui="form-disclosure"]')).toBeNull();
    fireEvent.change(input, { target: { value: 'reader@acme' } });
    fireEvent.blur(input);
    expect(screen.getByText('Enter a full address, like jordan@acme.dev.')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
```

- [ ] **Step 3: Run the spec to verify the changed cases fail**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/shared/Footer.spec.tsx`
Expected: FAIL on the label lookup and the new case.

- [ ] **Step 4: Rewrite `NewsletterForm`**

Replace the whole `NewsletterForm` function in `Footer.tsx` with:

```tsx
function NewsletterForm({ formPolicy }: { formPolicy: PublicFormPolicy }) {
  const [email, setEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const form = useGrowthForm<{ email: string }>({
    route: '/api/newsletter',
    formPolicy,
    events: {
      submit: analyticsEvents.marketingNewsletterSignupSubmit,
      success: analyticsEvents.marketingNewsletterSignupSuccess,
      fail: analyticsEvents.marketingNewsletterSignupFail,
    },
    analytics: { surface: 'footer', source_section: 'newsletter-form' },
  });
  const disclosureId = 'footer-newsletter-growth-disclosure';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = emailError(email);
    setEmailMessage(problem);
    if (problem) return;
    void form.submit({ email: email.trim() });
  };

  if (form.status === 'sent') {
    return (
      <div className="footer-newsletter">
        <FormStatus tone="success" title="Subscribed." detail="The first note from Brian arrives within a day." />
      </div>
    );
  }

  if (form.status === 'stale') {
    return (
      <div className="footer-newsletter">
        <FormStatus tone="stale" title="This page is out of date." detail={FORM_POLICY_REFRESH_MESSAGE}>
          <Button type="button" size="md" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </FormStatus>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="footer-newsletter" data-ui="form" data-compact="" noValidate>
      <Field id="footer-email" label="Email" error={emailMessage}>
        <div data-ui="form-row">
          <TextInput
            compact
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailMessage) setEmailMessage(emailError(e.target.value));
            }}
            onBlur={() => setEmailMessage(emailError(email))}
            disabled={form.status === 'pending'}
          />
          <SubmitButton size="md" pending={form.status === 'pending'} pendingLabel="Subscribing…" aria-describedby={disclosureId}>
            Subscribe
          </SubmitButton>
        </div>
      </Field>
      <p id={disclosureId} data-ui="form-disclosure">
        {formPolicy.disclosures.newsletter}
      </p>
      {form.status === 'failed' ? (
        <FormStatus tone="failure" title="That did not send." detail="Try again in a moment." />
      ) : null}
    </form>
  );
}
```

Update the imports at the top of `Footer.tsx`: remove `growthFormRequestSnapshot` and `GrowthFormRequestSnapshot` from the `form-client` import (keep `FORM_POLICY_REFRESH_MESSAGE`), remove `useRef` from the React import, remove `track` from the analytics import if nothing else in the file uses it (check with `grep -n "track(" apps/website/src/components/shared/Footer.tsx`; `trackCtaClick` and `trackExternalLinkClick` stay), and add:

```tsx
import { Field, FormStatus, SubmitButton, TextInput, emailError, useGrowthForm } from '../form';
```

- [ ] **Step 5: Replace the footer newsletter CSS**

In `apps/website/src/styles/chrome.css`, delete the `.footer-newsletter-success` and `.footer-newsletter-input` rules and add:

```css
.footer-newsletter {
  max-width: 320px;
  margin-bottom: 16px;
}
```

- [ ] **Step 6: Run the spec to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/shared/Footer.spec.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx apps/website/src/components/shared/Footer.spec.tsx apps/website/src/styles/chrome.css
git commit -m "fix(website): rebuild the footer newsletter on the form kit; the input no longer collapses"
```

---

## Task 8: E2E footer case and gate run for PR 1

**Files:**
- Modify: `apps/website/e2e/website.spec.ts:171-192` (footer newsletter case)

- [ ] **Step 1: Rewrite the footer e2e case**

Replace the `footer newsletter form posts to /api/newsletter and renders success state` test with:

```ts
test('footer newsletter form posts to /api/newsletter and renders success state', async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/newsletter', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/');
  const footer = page.locator('footer');
  const input = footer.getByLabel('Email');
  // Regression guard: the disclosure once sat inside the flex row and the input collapsed to 26px.
  expect((await input.boundingBox())?.width ?? 0).toBeGreaterThan(160);
  await input.fill('reader@acme.com');
  await footer.getByRole('button', { name: 'Subscribe' }).click();

  await expect(footer.getByRole('status')).toContainText('Subscribed.');
  expect(payload).toMatchObject({ email: 'reader@acme.com', policy_version: GROWTH_FORM_POLICY_VERSION });
  expect(payload?.['submission_id']).toMatch(UUID_V4);
});
```

- [ ] **Step 2: Run the gates**

```bash
npx nx lint website --skip-nx-cache
npx nx test website --skip-nx-cache
npx nx build website --skip-nx-cache
npx nx e2e website --skip-nx-cache --grep "footer newsletter"
```

Expected: all pass. If the build fails on the `SubmitButton` prop type, the `Extract<ButtonProps, { href?: undefined }>` narrowing is the place to look.

- [ ] **Step 3: Visual check**

Run: `npx nx serve website` and open `http://localhost:3000/`. Scroll to the footer. The email input must be wider than the button and the disclosure must sit under the row. Tab into the input: a blue ring appears. Type `reader@acme` and tab out: the red ring and the "Enter a full address" line appear.

- [ ] **Step 4: Commit and open PR 1**

```bash
git add apps/website/e2e/website.spec.ts
git commit -m "test(website): guard the footer newsletter input width end to end"
git push -u origin HEAD
gh pr create --title "feat(website): lead-form kit and footer newsletter fix" --body "PR 1 of 3 for docs/superpowers/specs/2026-09-03-lead-forms-system-design.md. Adds the form kit, forms.css with style contracts, useGrowthForm, and rebuilds the footer newsletter on it, which fixes the input that rendered 26px wide in production."
```

---

## Task 9: Contact page band layout and CSS

**Files:**
- Modify: `apps/website/src/styles/pages.css` (contact page rules)
- Modify: `apps/website/src/styles/marketing.css` (delete `.contact-form*` rules at the block starting `.contact-form-sent`)
- Modify: `apps/website/src/styles/style-contracts.spec.ts`

- [ ] **Step 1: Add a style contract for the band**

Append to `CONTRACTS`:

```ts
  {
    file: 'pages.css',
    selector: '.contact-band',
    why: 'Heading column and form card are grid siblings; without the grid the card drops below the heading and the page reads as the old single column.',
    requires: {
      display: /display:\s*grid/,
      'grid-template-columns': /grid-template-columns:/,
    },
  },
```

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/styles/style-contracts.spec.ts`
Expected: FAIL on `.contact-band`.

- [ ] **Step 2: Replace the contact page CSS**

In `apps/website/src/styles/pages.css`, delete `.contact-page-inner`, `.contact-page-eyebrow-spaced`, `.contact-page-subtitle`, `.contact-page-sla-wrap`, `.contact-page-links-row`, and `.sla-card`, `.sla-card-text` (the last two may live in `marketing.css`; delete wherever `grep -n "sla-card" apps/website/src/styles/*.css` finds them). Keep `.contact-alt-row`, `.contact-alt-link`, `.contact-alt-sep`. Add:

```css
.contact-band {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 48px;
  align-items: start;
}
.contact-band-eyebrow {
  margin-bottom: 16px;
}
.contact-band-lede {
  font-family: var(--font-inter);
  font-size: var(--text-body-lg);
  line-height: var(--text-body-lg--line-height);
  color: var(--color-text-secondary);
  margin: 0 0 24px;
  max-width: 48ch;
}
.contact-band-note {
  font-family: var(--font-inter);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--color-text-primary);
  border-left: 3px solid var(--color-accent);
  padding: 6px 0 6px 14px;
  margin: 0 0 24px;
}
.contact-band-channels {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.contact-band-channels-label {
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0;
}
.contact-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.contact-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-family: var(--font-inter);
  font-size: 13px;
  color: var(--color-text-primary);
  text-decoration: none;
  background: var(--color-surface);
}
.contact-chip:hover {
  border-color: var(--color-accent-border-hover);
  color: var(--color-accent);
}
@media (max-width: 900px) {
  .contact-band {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }
}
```

In `apps/website/src/styles/marketing.css`, delete the rules `.contact-form-sent`, `.contact-form`, `.contact-form-label`, `.contact-form-optional`, `.contact-form-input`, `.contact-form-textarea`, `.contact-form-error`.

- [ ] **Step 3: Run the contract spec to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/styles/style-contracts.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/styles/pages.css apps/website/src/styles/marketing.css apps/website/src/styles/style-contracts.spec.ts
git commit -m "feat(website): contact page band layout styles; drop the old contact-form rules"
```

---

## Task 10: `ContactForm` rebuilt with the enterprise intent

**Files:**
- Modify: `apps/website/src/components/contact/ContactForm.tsx` (full rewrite)
- Modify: `apps/website/src/components/contact/ContactForm.spec.tsx`

- [ ] **Step 1: Update the failing tests**

In `ContactForm.spec.tsx`:

- Change `fill()` to look up `/work email/i` instead of `/email/i`, and `/what are you shipping/i` instead of `/message/i`.
- Change `send()` to `screen.getByRole('button', { name: /send to brian/i })`.
- Replace the success assertions (`Thanks. We'll be in touch…`) with `expect(screen.getByRole('status').textContent).toContain('Sent.')`.
- Keep every growth-policy case; they assert the envelope, not the markup.
- Add, inside `describe('ContactForm')`:

```tsx
  it('validates the email on blur, names the fix, and blocks submit until fixed', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} />);
    const email = screen.getByLabelText(/work email/i);
    fireEvent.change(email, { target: { value: 'jane@acme' } });
    fireEvent.blur(email);
    expect(screen.getByText('Enter a full address, like jordan@acme.dev.')).toBeTruthy();
    send();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(email, { target: { value: 'jane@acme.com' } });
    expect(screen.queryByText('Enter a full address, like jordan@acme.dev.')).toBeNull();
  });

  it('in enterprise intent posts the pricing form kind with the timeline and entry point', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm formPolicy={formPolicy} intent="enterprise" entryPoint="pricing_tier_enterprise" />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/timeline/i), { target: { value: 'this_quarter' } });
    fireEvent.change(screen.getByLabelText(/tell us about your use case/i), { target: { value: 'Volume seats.' } });
    fireEvent.click(screen.getByRole('button', { name: /request a conversation/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock, 0)).toMatchObject({
      form_kind: 'pricing',
      email: 'jane@acme.com',
      company: 'Acme',
      timeline: 'this_quarter',
      message: 'Volume seats.',
    });
    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_submit',
      expect.objectContaining({ surface: 'pricing', entry_point: 'pricing_tier_enterprise' })
    );
  });

  it('in enterprise intent requires a timeline and says so', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<ContactForm formPolicy={formPolicy} intent="enterprise" />);
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /request a conversation/i }));
    expect(screen.getByText('Choose a timeline so we can route this.')).toBeTruthy();
  });
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/contact/ContactForm.spec.tsx`
Expected: FAIL on the new labels and the `intent` prop.

- [ ] **Step 3: Rewrite `ContactForm`**

```tsx
'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { analyticsEvents } from '../../lib/analytics/events';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { FORM_POLICY_REFRESH_MESSAGE } from '../../lib/growth/form-client';
import {
  Field,
  FormStatus,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  emailError,
  requiredError,
  useGrowthForm,
} from '../form';

export type ContactIntent = 'contact' | 'enterprise';

const TIMELINES = [
  ['this_quarter', 'This quarter'],
  ['next_quarter', 'Next quarter'],
  ['6_plus_months', '6+ months'],
  ['exploring', 'Just exploring'],
] as const;

type Timeline = (typeof TIMELINES)[number][0];

interface ContactFormProps {
  formPolicy: PublicFormPolicy;
  /** `enterprise` adds the timeline field and posts the pricing form kind. */
  intent?: ContactIntent;
  /** The CTA that brought the visitor here; reported to analytics. */
  entryPoint?: string;
}

const FOUNDER_EMAIL = 'brian@threadplane.ai';

export function ContactForm({ formPolicy, intent = 'contact', entryPoint }: ContactFormProps) {
  const enterprise = intent === 'enterprise';
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [timeline, setTimeline] = useState<Timeline | ''>('');
  const [message, setMessage] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null);

  const form = useGrowthForm({
    route: '/api/leads',
    formPolicy,
    events: {
      submit: analyticsEvents.marketingLeadFormSubmit,
      success: analyticsEvents.marketingLeadFormSuccess,
      fail: analyticsEvents.marketingLeadFormFail,
    },
    analytics: {
      surface: enterprise ? 'pricing' : 'contact',
      source_section: 'contact-form',
      ...(entryPoint ? { entry_point: entryPoint } : {}),
    },
  });
  const disclosureId = 'contact-form-growth-disclosure';
  const timelineError = 'Choose a timeline so we can route this.';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emailProblem = emailError(email);
    const timelineProblem = enterprise ? requiredError(timeline, timelineError) : null;
    setEmailMessage(emailProblem);
    setTimelineMessage(timelineProblem);
    if (emailProblem) {
      document.getElementById('contact-email')?.focus();
      return;
    }
    if (timelineProblem) {
      document.getElementById('contact-timeline')?.focus();
      return;
    }
    void form.submit({
      form_kind: enterprise ? 'pricing' : 'contact',
      email: email.trim(),
      ...(name ? { name } : {}),
      ...(company ? { company } : {}),
      ...(enterprise && timeline ? { timeline } : {}),
      ...(message ? { message } : {}),
    });
  }

  if (form.status === 'stale') {
    return (
      <FormStatus tone="stale" title="This page is out of date." detail={FORM_POLICY_REFRESH_MESSAGE}>
        <Button type="button" variant="primary" size="lg" onClick={() => window.location.reload()}>
          Refresh page
        </Button>
      </FormStatus>
    );
  }

  if (form.status === 'sent') {
    return <FormStatus tone="success" title="Sent." detail="Expect a reply within one business day." />;
  }

  return (
    <form onSubmit={handleSubmit} data-ui="form" noValidate>
      <Field id="contact-email" label="Work email" error={emailMessage}>
        <TextInput
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailMessage) setEmailMessage(emailError(e.target.value));
          }}
          onBlur={() => setEmailMessage(emailError(email))}
        />
      </Field>
      <Field id="contact-name" label="Name" optional>
        <TextInput type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="contact-company" label="Company" optional={!enterprise}>
        <TextInput type="text" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} />
      </Field>
      {enterprise ? (
        <Field id="contact-timeline" label="Timeline" error={timelineMessage}>
          <Select
            value={timeline}
            onChange={(e) => {
              setTimeline(e.target.value as Timeline | '');
              if (timelineMessage) setTimelineMessage(requiredError(e.target.value, timelineError));
            }}
          >
            <option value="" disabled>
              Select…
            </option>
            {TIMELINES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field id="contact-message" label={enterprise ? 'Tell us about your use case' : 'What are you shipping?'} optional>
        <TextArea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <p id={disclosureId} data-ui="form-disclosure">
        {formPolicy.disclosures.contact}
      </p>
      <SubmitButton
        variant="primary"
        size="lg"
        pending={form.status === 'pending'}
        pendingLabel="Sending…"
        aria-describedby={disclosureId}
      >
        {enterprise ? 'Request a conversation' : 'Send to Brian'}
      </SubmitButton>
      {form.status === 'failed' ? (
        <FormStatus tone="failure" title="That did not send." detail={<>Email <a href={`mailto:${FOUNDER_EMAIL}`}>{FOUNDER_EMAIL}</a> instead, or try again.</>} />
      ) : null}
    </form>
  );
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/contact/ContactForm.spec.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/contact/ContactForm.tsx apps/website/src/components/contact/ContactForm.spec.tsx
git commit -m "feat(website): rebuild ContactForm on the kit with an enterprise intent"
```

---

## Task 11: Contact page composition

**Files:**
- Modify: `apps/website/src/app/contact/page.tsx` (full rewrite)
- Delete: `apps/website/src/components/contact/SlaCard.tsx`
- Create: `apps/website/src/app/contact/page.spec.tsx`

- [ ] **Step 1: Write the failing page test**

`apps/website/src/app/contact/page.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/analytics/client', () => ({ track: vi.fn(), trackCtaClick: vi.fn(), trackExternalLinkClick: vi.fn() }));

import ContactPage from './page';

describe('ContactPage', () => {
  it('renders the contact variant by default', async () => {
    render(await ContactPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText('Contact', { selector: '[data-ui="eyebrow"]' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Talk to an engineer.');
    expect(screen.getByRole('button', { name: 'Send to Brian' })).toBeTruthy();
    expect(screen.queryByLabelText('Timeline')).toBeNull();
    expect(screen.getByRole('link', { name: 'brian@threadplane.ai' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'GitHub issues' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Discord' })).toBeTruthy();
  });

  it('renders the enterprise variant from the intent query and passes the entry point through', async () => {
    render(await ContactPage({ searchParams: Promise.resolve({ intent: 'enterprise', entry: 'pricing_tier_enterprise' }) }));
    expect(screen.getByText('Enterprise', { selector: '[data-ui="eyebrow"]' })).toBeTruthy();
    expect(screen.getByLabelText('Timeline')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request a conversation' })).toBeTruthy();
  });

  it('ignores unknown intents and unsafe entry values', async () => {
    render(await ContactPage({ searchParams: Promise.resolve({ intent: 'weird', entry: '<script>' }) }));
    expect(screen.getByRole('button', { name: 'Send to Brian' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/app/contact/page.spec.tsx`
Expected: FAIL (page does not accept `searchParams`; no chips).

- [ ] **Step 3: Rewrite the page**

```tsx
import React, { Suspense } from 'react';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { FormCard } from '../../components/form';
import { ContactForm, type ContactIntent } from '../../components/contact/ContactForm';
import { GitHubStarsPill } from '../../components/contact/GitHubStarsPill';
import { createPageMetadata } from '../../lib/site-metadata';
import { getFormPolicy } from '../../lib/growth/form-policy';

export const metadata = createPageMetadata({
  title: 'Talk to an engineer — Threadplane',
  description: 'Tell us what you are shipping. We reply within one business day, usually with code, not a calendar invite.',
  pathname: '/contact',
  type: 'website',
});

const ENTRY_POINT = /^[a-z0-9_]{1,64}$/u;

function readIntent(value: string | undefined): ContactIntent {
  return value === 'enterprise' ? 'enterprise' : 'contact';
}

function readEntryPoint(value: string | undefined): string | undefined {
  return value && ENTRY_POINT.test(value) ? value : undefined;
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; entry?: string }>;
}) {
  const params = await searchParams;
  const intent = readIntent(params.intent);
  const entryPoint = readEntryPoint(params.entry);
  const formPolicy = getFormPolicy();
  return (
    <Section surface="tinted" ariaLabelledBy="contact-heading">
      <Container>
        <div className="contact-band">
          <div>
            <Eyebrow tone="accent" className="contact-band-eyebrow">
              {intent === 'enterprise' ? 'Enterprise' : 'Contact'}
            </Eyebrow>
            <h1 id="contact-heading" className="contact-page-h1">
              Talk to an engineer.
            </h1>
            <p className="contact-band-lede">
              Tell us what you are shipping. We reply within one business day, usually with code, not a calendar invite.
            </p>
            <p className="contact-band-note">
              Brian or someone on the team replies personally, from a real inbox, not <code>noreply@</code>. We read every message.
            </p>
            <div className="contact-band-channels">
              <p className="contact-band-channels-label">Prefer not to use a form</p>
              <div className="contact-chips">
                <a className="contact-chip" href="mailto:brian@threadplane.ai">brian@threadplane.ai</a>
                <a className="contact-chip" href="https://github.com/cacheplane/angular-agent-framework/issues">GitHub issues</a>
                <a className="contact-chip" href="https://discord.gg/cacheplane">Discord</a>
              </div>
              <GitHubStarsPill />
            </div>
          </div>
          <FormCard>
            <Suspense>
              <ContactForm formPolicy={formPolicy} intent={intent} entryPoint={entryPoint} />
            </Suspense>
          </FormCard>
        </div>
      </Container>
    </Section>
  );
}
```

Delete `apps/website/src/components/contact/SlaCard.tsx` and `AltChannelRow.tsx` (its links now live in the chips). Run `grep -rn "SlaCard\|AltChannelRow" apps/website/src` and remove any remaining import.

Keep `.contact-page-h1` in `pages.css`; it is still used.

- [ ] **Step 4: Run the page spec and the whole contact folder**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/app/contact apps/website/src/components/contact`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A apps/website/src/app/contact apps/website/src/components/contact
git commit -m "feat(website): contact page band with the form card and an enterprise intent"
```

---

## Task 12: Pricing CTA band; delete `LeadForm`

**Files:**
- Create: `apps/website/src/components/pricing/EnterpriseCtaBand.tsx`
- Create: `apps/website/src/components/pricing/EnterpriseCtaBand.spec.tsx`
- Modify: `apps/website/src/components/pricing/CompareTable.tsx:21-31`
- Modify: `apps/website/src/app/pricing/page.tsx:7,66`
- Delete: `apps/website/src/components/pricing/LeadForm.tsx`, `LeadForm.spec.tsx`
- Modify: `apps/website/src/styles/marketing.css` (delete every `.lead-form-*` rule)

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const trackCtaClick = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick }));

import { EnterpriseCtaBand } from './EnterpriseCtaBand';

describe('EnterpriseCtaBand', () => {
  it('links to the enterprise contact intent with its entry point', () => {
    render(<EnterpriseCtaBand />);
    const link = screen.getByRole('link', { name: 'Request a conversation' });
    expect(link.getAttribute('href')).toBe('/contact?intent=enterprise&entry=pricing_enterprise_band');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Choose the support.');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/pricing/EnterpriseCtaBand.spec.tsx`
Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Write the band**

```tsx
'use client';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';

const HREF = '/contact?intent=enterprise&entry=pricing_enterprise_band';

export function EnterpriseCtaBand() {
  return (
    <Section id="enterprise" surface="tinted" ariaLabelledBy="enterprise-band-heading">
      <Container>
        <div className="enterprise-band">
          <Eyebrow tone="accent" className="enterprise-band-eyebrow">Enterprise</Eyebrow>
          <h2 id="enterprise-band-heading" className="enterprise-band-heading">
            Choose the support. Add delivery if you need it.
          </h2>
          <p className="enterprise-band-lede">
            Production Assurance and Pilot-to-Prod are separate choices. Tell us where you are and we will scope the right one.
          </p>
          <Button
            href={HREF}
            variant="primary"
            size="lg"
            onClick={() =>
              trackCtaClick({
                surface: 'pricing',
                destination_url: HREF,
                cta_id: 'pricing_enterprise_band',
                cta_text: 'Request a conversation',
              })
            }
          >
            Request a conversation
          </Button>
        </div>
      </Container>
    </Section>
  );
}
```

Add `'pricing_enterprise_band'` to the `CtaId` union in `apps/website/src/lib/analytics/events.ts` next to the other `pricing_*` members.

Add to `apps/website/src/styles/marketing.css` (replacing the deleted `.lead-form-*` block):

```css
.enterprise-band {
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.enterprise-band-eyebrow {
  margin-bottom: 4px;
}
.enterprise-band-heading {
  font-family: var(--font-garamond);
  font-size: var(--text-h2);
  line-height: var(--text-h2--line-height);
  color: var(--color-text-primary);
  margin: 0;
}
.enterprise-band-lede {
  font-family: var(--font-inter);
  font-size: var(--text-body-lg);
  line-height: var(--text-body-lg--line-height);
  color: var(--color-text-secondary);
  margin: 0 0 8px;
}
```

- [ ] **Step 4: Point the plan buttons at the intent**

In `CompareTable.tsx`, change the two hrefs:

```ts
  production_assurance: {
    label: 'Discuss assurance',
    ctaId: 'pricing_tier_production_assurance',
    href: '/contact?intent=enterprise&entry=pricing_tier_production_assurance',
  },
  enterprise: {
    label: 'Talk to Sales',
    ctaId: 'pricing_tier_enterprise',
    href: '/contact?intent=enterprise&entry=pricing_tier_enterprise',
  },
```

In `apps/website/src/app/pricing/page.tsx`, replace the `LeadForm` import with `import { EnterpriseCtaBand } from '../../components/pricing/EnterpriseCtaBand';`, replace `<LeadForm formPolicy={formPolicy} />` with `<EnterpriseCtaBand />`, and delete the now-unused `formPolicy` const and `getFormPolicy` import if nothing else uses them.

Delete `LeadForm.tsx` and `LeadForm.spec.tsx`. Delete every `.lead-form-*` rule from `marketing.css` (including those inside the `@media` blocks at lines 295–330). Run `grep -rn "lead-form\|LeadForm" apps/website/src apps/website/e2e` and fix every remaining reference.

- [ ] **Step 5: Run the pricing specs and the whole suite**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/pricing && npx nx test website --skip-nx-cache`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A apps/website/src/components/pricing apps/website/src/app/pricing apps/website/src/styles/marketing.css apps/website/src/lib/analytics/events.ts
git commit -m "feat(website): pricing CTA band replaces the enterprise lead form"
```

---

## Task 13: E2E for contact, enterprise intent, pricing; PR 2

**Files:**
- Modify: `apps/website/e2e/website.spec.ts:90-169`

- [ ] **Step 1: Rewrite the three cases**

Replace `pricing page lead form validates required fields`, `contact page submits a lead payload and renders success state`, and `pricing lead form posts to /api/leads and renders success state` with:

```ts
test('pricing plan buttons lead to the enterprise contact intent', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('link', { name: 'Talk to Sales' })).toHaveAttribute('href', '/contact?intent=enterprise&entry=pricing_tier_enterprise');
  await expect(page.getByRole('link', { name: 'Request a conversation' })).toHaveAttribute('href', '/contact?intent=enterprise&entry=pricing_enterprise_band');
  await expect(page.locator('#lead-form')).toHaveCount(0);
});

test('contact page submits a lead payload and renders success state', async ({ page }) => {
  let leadPayload: Record<string, unknown> | undefined;
  await page.route('**/api/leads', async (route) => {
    leadPayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/contact');
  const form = page.locator('main form').first();
  await form.getByLabel('Work email').fill('jane@acme.com');
  await form.getByLabel('Name').fill('Jane Smith');
  await form.getByLabel('Company').fill('Acme');
  await form.getByLabel('What are you shipping?').fill('We are evaluating Threadplane.');
  await form.getByRole('button', { name: 'Send to Brian' }).click();

  await expect(page.getByRole('status')).toContainText('Sent.');
  expect(leadPayload).toMatchObject({
    form_kind: 'contact',
    email: 'jane@acme.com',
    name: 'Jane Smith',
    company: 'Acme',
    message: 'We are evaluating Threadplane.',
    policy_version: GROWTH_FORM_POLICY_VERSION,
  });
  expect(leadPayload?.['submission_id']).toMatch(UUID_V4);
});

test('contact page enterprise intent posts the pricing form kind with a timeline', async ({ page }) => {
  let leadPayload: Record<string, unknown> | undefined;
  await page.route('**/api/leads', async (route) => {
    leadPayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/contact?intent=enterprise&entry=pricing_tier_enterprise');
  const form = page.locator('main form').first();
  await form.getByRole('button', { name: 'Request a conversation' }).click();
  await expect(form.getByText('Enter your email address.')).toBeVisible();

  await form.getByLabel('Work email').fill('jane@acme.com');
  await form.getByLabel('Company').fill('Acme');
  await form.getByLabel('Timeline').selectOption('this_quarter');
  await form.getByLabel('Tell us about your use case').fill('Volume seats and security review.');
  await form.getByRole('button', { name: 'Request a conversation' }).click();

  await expect(page.getByRole('status')).toContainText('Sent.');
  expect(leadPayload).toMatchObject({
    form_kind: 'pricing',
    email: 'jane@acme.com',
    company: 'Acme',
    timeline: 'this_quarter',
    message: 'Volume seats and security review.',
    policy_version: GROWTH_FORM_POLICY_VERSION,
  });
});
```

- [ ] **Step 2: Run the gates**

```bash
npx nx lint website --skip-nx-cache
npx nx test website --skip-nx-cache
npx nx build website --skip-nx-cache
npx nx e2e website --skip-nx-cache --grep "contact page|pricing plan buttons"
```

Expected: all pass.

- [ ] **Step 3: Visual check**

`npx nx serve website`, open `/contact` and `/contact?intent=enterprise`. Desktop: heading column left, white card right on the tinted band. Below 900 px: one column. Tab order: email, name, company, (timeline), message, button. Then `/pricing`: the bottom section is the band with one button.

- [ ] **Step 4: Commit and open PR 2**

```bash
git add apps/website/e2e/website.spec.ts
git commit -m "test(website): e2e for the contact band, enterprise intent, and pricing band"
git push -u origin HEAD
gh pr create --title "feat(website): contact page on the form kit; enterprise form merges into it" --body "PR 2 of 3 for docs/superpowers/specs/2026-09-03-lead-forms-system-design.md. Contact page becomes a tinted band with the form card; /contact?intent=enterprise carries the trimmed enterprise form; /pricing keeps a CTA band and LeadForm is deleted."
```

---

## Task 14: Whitepaper block on the kit

**Files:**
- Modify: `apps/website/src/components/landing/WhitePaperBlock.tsx`
- Modify: `apps/website/src/components/landing/WhitePaperBlock.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Update the failing tests**

In `WhitePaperBlock.spec.tsx`: replace `getByLabelText('Email address')` (or `/email/i`) with `getByLabelText('Work email')`; replace `getByRole('button', { name: /download \(free\)/i })` with `getByRole('button', { name: 'Get the field report' })`; replace the done-state assertion with `expect(screen.getByRole('status').textContent).toContain('Check your inbox.')`. Keep every envelope assertion. Add:

```tsx
  it('shows the direct PDF link in the failure block', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<WhitePaperBlock formPolicy={formPolicy} paper="chat" />);
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'reader@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get the field report' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Download the PDF directly' }).getAttribute('href')).toBe('/whitepapers/chat.pdf');
  });
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/landing/WhitePaperBlock.spec.tsx`
Expected: FAIL on labels and button name.

- [ ] **Step 3: Rewrite the form parts of `WhitePaperBlock`**

Replace the state, submit handler, and the form JSX. The final component:

```tsx
'use client';
import { useState } from 'react';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { FORM_POLICY_REFRESH_MESSAGE } from '../../lib/growth/form-client';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { analyticsEvents } from '../../lib/analytics/events';
import { trackWhitepaperDownloadClick } from '../../lib/analytics/client';
import { Field, FormStatus, SubmitButton, TextInput, emailError, useGrowthForm } from '../form';

const ROWS = [
  { claim: 'Six production-readiness dimensions', tail: '18 pages' },
  { claim: 'Error boundaries, fallbacks, observability, deploy', tail: 'concrete patterns' },
  { claim: 'No vendor pitch — what we learned shipping it', tail: 'free' },
];

type WhitepaperId = 'overview' | 'angular' | 'render' | 'chat';

interface WhitePaperBlockProps {
  paper?: WhitepaperId;
  formPolicy: PublicFormPolicy;
}

const PDF_PATHS: Record<WhitepaperId, { href: string; download: string }> = {
  overview: { href: '/whitepaper.pdf', download: 'angular-agent-readiness-guide.pdf' },
  angular: { href: '/whitepapers/angular.pdf', download: 'angular-streaming-guide.pdf' },
  render: { href: '/whitepapers/render.pdf', download: 'angular-genui-guide.pdf' },
  chat: { href: '/whitepapers/chat.pdf', download: 'angular-chat-guide.pdf' },
};

export function WhitePaperBlock({ formPolicy, paper = 'overview' }: WhitePaperBlockProps) {
  const pdf = PDF_PATHS[paper];
  const [email, setEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const form = useGrowthForm<{ email: string; paper: WhitepaperId }>({
    route: '/api/whitepaper-signup',
    formPolicy,
    events: {
      submit: analyticsEvents.marketingWhitepaperSignupSubmit,
      success: analyticsEvents.marketingWhitepaperSignupSuccess,
      fail: analyticsEvents.marketingWhitepaperSignupFail,
    },
    analytics: { surface: 'home_whitepaper', source_section: 'whitepaper-block', paper },
  });
  const disclosureId = `wp-${paper}-growth-disclosure`;
  const inputId = `wp-${paper}-email`;

  const directLink = (ctaId: 'home_whitepaper_direct' | 'home_whitepaper_direct_inline', label: string) => (
    <a
      href={pdf.href}
      download={pdf.download}
      onClick={() => trackWhitepaperDownloadClick(paper, { surface: 'home_whitepaper', source_section: 'whitepaper-block', cta_id: ctaId })}
    >
      {label}
    </a>
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = emailError(email);
    setEmailMessage(problem);
    if (problem) return;
    void form.submit({ email: email.trim(), paper });
  };

  return (
    <Section surface="white" id="whitepaper-block" ariaLabelledBy="wp-heading">
      <Container>
        <div className="wp-grid">
          <div>
            <div className="wp-rail">
              <Eyebrow tone="accent" className="wp-eyebrow">Field report</Eyebrow>
              <span className="wp-rail-line" aria-hidden="true" />
            </div>
            <h2 id="wp-heading" className="wp-heading">
              The last-mile gap in Angular AI.
            </h2>
            <div className="wp-rows">
              {ROWS.map((r) => (
                <div key={r.claim} className="wp-row">
                  <p className="wp-row-claim">{r.claim}</p>
                  <p className="wp-row-tail">{r.tail}</p>
                </div>
              ))}
            </div>

            {form.status === 'sent' ? (
              <FormStatus tone="success" title="Check your inbox." detail="The guide is on its way, and the PDF is here too.">
                {directLink('home_whitepaper_direct', 'Download the PDF directly')}
              </FormStatus>
            ) : form.status === 'stale' ? (
              <FormStatus tone="stale" title="This page is out of date." detail={FORM_POLICY_REFRESH_MESSAGE}>
                <Button type="button" variant="primary" size="lg" onClick={() => window.location.reload()}>
                  Refresh page
                </Button>
              </FormStatus>
            ) : (
              <form onSubmit={submit} className="wp-form" data-ui="form" noValidate>
                <Field id={inputId} label="Work email" error={emailMessage}>
                  <div data-ui="form-row">
                    <TextInput
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailMessage) setEmailMessage(emailError(e.target.value));
                      }}
                      onBlur={() => setEmailMessage(emailError(email))}
                      disabled={form.status === 'pending'}
                    />
                    <SubmitButton variant="primary" size="lg" pending={form.status === 'pending'} pendingLabel="Sending the guide…" aria-describedby={disclosureId}>
                      Get the field report
                    </SubmitButton>
                  </div>
                </Field>
                <p id={disclosureId} data-ui="form-disclosure">
                  {formPolicy.disclosures.whitepaper}
                </p>
                {form.status === 'failed' ? (
                  <FormStatus tone="failure" title="That did not send." detail="You can still get the guide.">
                    {directLink('home_whitepaper_direct', 'Download the PDF directly')}
                  </FormStatus>
                ) : null}
                <p className="wp-already">Already on the list? {directLink('home_whitepaper_direct_inline', 'Download the PDF directly.')}</p>
              </form>
            )}
          </div>

          {/* Tilted whitepaper cover: unchanged from the current file */}
```

Keep the cover-art block exactly as it exists today (from `{/* Tilted whitepaper cover */}` to the end of the component).

- [ ] **Step 4: Trim `landing.css`**

Delete `.wp-success`, `.wp-success-link`, `.wp-form`'s old declarations, `.wp-email-input`, `.wp-disclosure`, `.wp-error`, `.wp-error-link`, `.wp-already-link`. Replace with:

```css
.wp-form {
  max-width: 520px;
}
.wp-already {
  margin-top: 4px;
  font-size: 13px;
  color: var(--color-text-muted);
  font-family: var(--font-inter);
}
.wp-already a {
  color: var(--color-accent);
  text-decoration: underline;
}
```

Also delete the `.wp-success` entry inside the `@media (max-width: 640px)` block at `landing.css:317-325` if present.

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/landing/WhitePaperBlock.spec.tsx`
Expected: PASS.

- [ ] **Step 6: Update the whitepaper e2e case**

In `apps/website/e2e/website.spec.ts`, in `whitepaper signup form posts…`, change `getByLabel('Email address')` to `getByLabel('Work email')` and the button name to `'Get the field report'`; keep the `/check your inbox/i` assertion.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/landing/WhitePaperBlock.tsx apps/website/src/components/landing/WhitePaperBlock.spec.tsx apps/website/src/styles/landing.css apps/website/e2e/website.spec.ts
git commit -m "feat(website): whitepaper block form on the kit"
```

---

## Task 15: Announcement toast on the kit

**Files:**
- Modify: `apps/website/src/components/shared/AnnouncementToast.tsx`
- Modify: `apps/website/src/components/shared/AnnouncementToast.spec.tsx`
- Modify: `apps/website/src/styles/chrome.css`

- [ ] **Step 1: Update the failing tests**

In `AnnouncementToast.spec.tsx`, the growth-policy cases look up the email field and the submit button. Change `getByLabelText('Email address')` (or `/email/i`) to `getByLabelText('Work email')`, and the button name from `/send me the guide/i` to `'Get the field report'`. Replace any `Check your inbox — the guide is on its way!` assertion with `expect(screen.getByRole('status').textContent).toContain('Check your inbox.')`. Keep the trigger and dismissal cases untouched. Add:

```tsx
  it('reports a failed send instead of pretending it succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<AnnouncementToast formPolicy={formPolicy} />);
    reveal(); // the spec's existing helper that advances the timer and scrolls 40%
    fireEvent.click(screen.getByRole('button', { name: /get the guide/i }));
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'reader@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get the field report' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('That did not send.'));
  });
```

If the spec has no `reveal()` helper, use the same two calls its "appears once BOTH the timer and the 40% scroll threshold are met" case uses.

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/shared/AnnouncementToast.spec.tsx`
Expected: FAIL on labels and the failure case.

- [ ] **Step 3: Rewrite the form parts of the toast**

Replace the imports, state, `handleSubmit`, and the `form`/`stale`/`sent` branches. Trigger and dismissal effects stay exactly as they are.

```tsx
import { useState, useEffect } from 'react';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { FORM_POLICY_REFRESH_MESSAGE } from '../../lib/growth/form-client';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';
import { Button } from '../ui/Button';
import { Field, FormStatus, SubmitButton, TextInput, emailError, useGrowthForm } from '../form';
```

State: keep `visible`, `mounted`, `step`, `email`, `timerDone`, `scrolledEnough`; remove `submitting` and `submissionSnapshot`; add `const [emailMessage, setEmailMessage] = useState<string | null>(null);` and:

```tsx
  const form = useGrowthForm<{ email: string; paper: 'overview' }>({
    route: '/api/whitepaper-signup',
    formPolicy,
    events: {
      submit: analyticsEvents.marketingWhitepaperSignupSubmit,
      success: analyticsEvents.marketingWhitepaperSignupSuccess,
      fail: analyticsEvents.marketingWhitepaperSignupFail,
    },
    analytics: { surface: 'toast', source_section: 'announcement-toast', paper: 'overview' },
  });
```

Replace `handleSubmit` with:

```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = emailError(email);
    setEmailMessage(problem);
    if (problem) return;
    void form.submit({ email: email.trim(), paper: 'overview' });
  };

  // Mirror the hook's terminal states onto the toast's step machine.
  // Place this effect AFTER the existing `const dismiss = () => { ... }` so
  // the reference is defined; the file currently defines dismiss below the
  // trigger effects.
  useEffect(() => {
    if (form.status === 'sent') {
      setStep('sent');
      const id = setTimeout(dismiss, 4000);
      return () => clearTimeout(id);
    }
    if (form.status === 'stale') setStep('stale');
    return undefined;
    // dismiss is stable for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.status]);
```

Replace the `step === 'form'` branch with:

```tsx
      {step === 'form' && (
        <form onSubmit={handleSubmit} className="toast-mt-section" data-ui="form" data-compact="" noValidate>
          <Field id="toast-email" label="Work email" error={emailMessage}>
            <TextInput
              compact
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailMessage) setEmailMessage(emailError(e.target.value));
              }}
              onBlur={() => setEmailMessage(emailError(email))}
              disabled={form.status === 'pending'}
              autoFocus
            />
          </Field>
          <p id={disclosureId} data-ui="form-disclosure">
            {formPolicy.disclosures.whitepaper}
          </p>
          <div className="toast-button-row">
            <SubmitButton variant="primary" size="md" pending={form.status === 'pending'} pendingLabel="Sending the guide…" aria-describedby={disclosureId}>
              Get the field report
            </SubmitButton>
          </div>
          {form.status === 'failed' ? (
            <FormStatus tone="failure" title="That did not send." detail="You can still get the guide.">
              <a
                href="/whitepaper.pdf"
                download="angular-agent-readiness-guide.pdf"
                onClick={() => {
                  trackWhitepaperDownloadClick('overview', { surface: 'toast', source_section: 'announcement-toast', cta_id: 'toast_direct_download' });
                  dismiss();
                }}
              >
                Download the PDF directly
              </a>
            </FormStatus>
          ) : null}
          <a
            href="/whitepaper.pdf"
            download="angular-agent-readiness-guide.pdf"
            onClick={() => {
              trackWhitepaperDownloadClick('overview', { surface: 'toast', source_section: 'announcement-toast', cta_id: 'toast_direct_download' });
              dismiss();
            }}
            className="toast-download-link"
          >
            or download directly
          </a>
        </form>
      )}
```

Replace the `stale` and `sent` branches with:

```tsx
      {step === 'stale' && (
        <div className="toast-mt-section">
          <FormStatus tone="stale" title="This page is out of date." detail={FORM_POLICY_REFRESH_MESSAGE}>
            <Button type="button" variant="primary" size="md" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </FormStatus>
        </div>
      )}

      {step === 'sent' && (
        <div className="toast-mt-section">
          <FormStatus tone="success" title="Check your inbox." detail="The guide is on its way." />
        </div>
      )}
```

- [ ] **Step 4: Trim `chrome.css`**

Delete `.toast-input`, `.toast-input:focus`, `.toast-disclosure`, `.toast-success-text`. Keep `.toast-download-link` but change its `font-size` to `12px` and add `min-height: 24px; display: inline-flex; align-items: center;` so the target meets 24 px. In `.toast-not-now`, change `padding: 8px 4px` to `padding: 8px 6px` and add `min-height: 24px`.

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npx vitest run --config apps/website/vite.config.mts apps/website/src/components/shared/AnnouncementToast.spec.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/shared/AnnouncementToast.tsx apps/website/src/components/shared/AnnouncementToast.spec.tsx apps/website/src/styles/chrome.css
git commit -m "feat(website): announcement toast form on the kit; failures are reported"
```

---

## Task 16: Final sweep, gates, PR 3

- [ ] **Step 1: Confirm no old form CSS or components remain**

```bash
grep -rn -E "contact-form-|lead-form-|wp-email-input|wp-disclosure|wp-success|footer-newsletter-(input|success)|toast-input|toast-success-text|toast-disclosure" apps/website/src apps/website/e2e
grep -rn -E "SlaCard|AltChannelRow|LeadForm\b" apps/website/src apps/website/e2e
```

Expected: no output from either. Fix anything found.

- [ ] **Step 2: Run every gate**

```bash
npx nx lint website --skip-nx-cache
npx nx test website --skip-nx-cache
npx nx build website --skip-nx-cache
npx nx e2e website --skip-nx-cache
```

Expected: all pass. The public-copy gate runs inside e2e in production mode in CI; locally it is skipped unless `WEBSITE_E2E_MODE=production` is set, so also run:

```bash
WEBSITE_E2E_MODE=production GROWTH_FORM_POLICY=growth_v1 npx nx e2e website --skip-nx-cache --grep "public copy boundary|canonical policy surface"
```

- [ ] **Step 3: Visual check of all four surfaces**

`npx nx serve website`. Check `/` whitepaper block (label above the field, inline button, error on blur), the toast after 30 s and 40 % scroll (compact field, same copy, error on blur, failure block when the API is down), `/contact` and the enterprise variant, `/pricing` band, and the footer on any page. Reduced motion: no card transition.

- [ ] **Step 4: Commit and open PR 3**

```bash
git push -u origin HEAD
gh pr create --title "feat(website): whitepaper block and toast on the form kit; old form CSS removed" --body "PR 3 of 3 for docs/superpowers/specs/2026-09-03-lead-forms-system-design.md. Whitepaper block and announcement toast compose the kit; the last of the per-surface form CSS is deleted."
```

- [ ] **Step 5: Manual production gate after each deploy**

After each PR auto-promotes, submit one real form per changed surface with your own address and confirm in Neon (`growth_contacts`, `growth_jobs`, `growth_activity` by `data->>'source_section'`) and in PostHog (events by `surface`). Then delete the synthetic contact with `npm run growth:control -- delete --email <address>` exactly as the cutover runbook prescribes.
