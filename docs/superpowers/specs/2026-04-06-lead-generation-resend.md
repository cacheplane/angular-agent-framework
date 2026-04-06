# Lead Generation — Resend Integration

## Goal

Wire all website forms to Resend so that lead submissions send email notifications, white paper requests deliver the PDF via email, and newsletter signups are captured in a Resend audience. Currently, `/api/leads` only logs to console and `/api/whitepaper-signup` only appends to a local NDJSON file.

## Tech Stack

- Resend SDK (`resend` npm package)
- React Email for email templates
- Vercel environment variables for API keys
- Existing Next.js API routes

## Architecture

```
Form submit → API route → Resend SDK → Email delivered
                       → NDJSON append (local backup)
                       → Resend Audience (contact list)
```

One shared `lib/resend.ts` module wraps the Resend SDK and exports helper functions. Three API routes consume it.

---

## Shared Module

**File:** Create `apps/website/lib/resend.ts`

```ts
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || '';
export const FROM = process.env.RESEND_FROM || 'Angular Stream Resource <hello@cacheplane.io>';
export const NOTIFY_TO = process.env.RESEND_NOTIFY_TO || 'hello@cacheplane.io';
```

---

## API Routes

### 1. `/api/leads` (upgrade existing)

**File:** `apps/website/src/app/api/leads/route.ts`

Current behavior: validates name + email, logs to console.

**Add:**
1. Send notification email to `NOTIFY_TO` using `emails/lead-notification.tsx` template
2. Add contact to Resend audience (email, first name, metadata: company)
3. Keep NDJSON append as backup (create `data/leads.ndjson` if not exists)
4. Wrap Resend calls in try/catch — form should still return `{ ok: true }` even if Resend fails (degrade gracefully, log error)

### 2. `/api/whitepaper-signup` (upgrade existing)

**File:** `apps/website/src/app/api/whitepaper-signup/route.ts`

Current behavior: validates email, appends to `data/whitepaper-signups.ndjson`.

**Add:**
1. Send email to the user with PDF download link using `emails/whitepaper-download.tsx` template
2. Add contact to Resend audience
3. Keep NDJSON append

### 3. `/api/newsletter` (new)

**File:** Create `apps/website/src/app/api/newsletter/route.ts`

- Accept: `{ email: string }`
- Validate: email required, contains `@`
- Add contact to Resend audience
- Send welcome email using `emails/newsletter-welcome.tsx` template
- Return `{ ok: true }`
- Graceful degradation on Resend failure

---

## Email Templates

**Directory:** Create `apps/website/emails/`

### `lead-notification.tsx`

Internal notification sent to the team.

- **To:** `NOTIFY_TO`
- **Subject:** `New lead: {name} at {company}`
- **Body:** Name, email, company, message, timestamp. Simple text layout with the product header.

### `whitepaper-download.tsx`

Sent to the user after white paper form submission.

- **To:** User's email
- **Subject:** `Your Angular Agent Readiness Guide`
- **Body:** Brief intro, prominent "Download the Guide" button linking to `https://stream-resource.dev/whitepaper.pdf`, chapter summary list.

### `newsletter-welcome.tsx`

Sent to the user after newsletter signup.

- **To:** User's email
- **Subject:** `Welcome to Angular Stream Resource updates`
- **Body:** Brief confirmation, what to expect (product updates, new capabilities), link to docs.

All templates use React Email components (`@react-email/components`) with inline styles matching the site's design tokens (navy text, blue accent, EB Garamond headings where appropriate).

---

## Configuration

**File:** Update `apps/website/.env.example`

```
# Resend (https://resend.com — free tier: 3,000 emails/month)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_AUDIENCE_ID=aud_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM="Angular Stream Resource <hello@cacheplane.io>"
RESEND_NOTIFY_TO=hello@cacheplane.io
```

**Vercel setup:**
1. Install Resend integration from Vercel marketplace (auto-provisions `RESEND_API_KEY`)
2. Create one audience in Resend dashboard: "Angular Stream Resource"
3. Copy audience ID to `RESEND_AUDIENCE_ID` env var
4. Set `RESEND_FROM` and `RESEND_NOTIFY_TO` in Vercel project settings

---

## Dependencies

Add to `apps/website/package.json`:
- `resend` — Resend SDK
- `@react-email/components` — React Email component library (for template rendering)

---

## Error Handling

All Resend calls are wrapped in try/catch. On failure:
- Log the error with `console.error('[resend]', error)`
- Still return `{ ok: true }` to the client (don't block the user experience)
- NDJSON backup ensures data is never lost even if Resend is down

---

## Verification

1. **Leads form** (pricing page): Submit form → check inbox for notification email + check Resend dashboard for audience contact
2. **White paper form** (home page): Submit form → check user inbox for PDF download email + check Resend audience
3. **Newsletter form** (footer): Submit email → check inbox for welcome email + check Resend audience
4. **Direct download** ("skip" link): Verify `/whitepaper.pdf` still downloads without form
5. **Error resilience**: Set invalid `RESEND_API_KEY` → verify forms still return `{ ok: true }` and NDJSON files still write
6. **Vercel preview deploy**: Push branch → verify env vars are set → test all three forms on preview URL
