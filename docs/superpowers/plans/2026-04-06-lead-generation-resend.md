# Lead Generation — Resend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all website forms to Resend so lead submissions send email notifications, white paper requests deliver the PDF via email, and newsletter signups are captured in a Resend audience.

**Architecture:** A shared `lib/resend.ts` module wraps the Resend SDK. Three API routes (`/api/leads`, `/api/whitepaper-signup`, `/api/newsletter`) each call Resend for email delivery + audience management, with NDJSON append as local backup. Three React Email templates render branded emails.

**Tech Stack:** Resend SDK, React Email (`@react-email/components`), Next.js API routes, Vercel env vars

---

### Task 1: Install dependencies and configure environment

**Files:**
- Modify: `apps/website/package.json`
- Modify: `apps/website/.env.example`

- [ ] **Step 1: Install Resend and React Email**

```bash
cd apps/website && npm install resend @react-email/components
```

- [ ] **Step 2: Update `.env.example`**

Add these lines to the end of `apps/website/.env.example`:

```
# Resend (https://resend.com — free tier: 3,000 emails/month)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_AUDIENCE_ID=aud_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM="Angular Agent Framework <hello@cacheplane.io>"
RESEND_NOTIFY_TO=hello@cacheplane.io
```

- [ ] **Step 3: Create local `.env.local` with real keys**

Create `apps/website/.env.local` (gitignored) with your actual Resend API key. You can get one from https://resend.com/api-keys. Create an audience at https://resend.com/audiences and copy the ID.

- [ ] **Step 4: Commit**

```bash
git add apps/website/package.json apps/website/package-lock.json apps/website/.env.example
git commit -m "chore: install resend and react-email dependencies"
```

---

### Task 2: Create shared Resend module

**Files:**
- Create: `apps/website/lib/resend.ts`

- [ ] **Step 1: Create the shared module**

Create `apps/website/lib/resend.ts`:

```ts
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || '';
export const FROM = process.env.RESEND_FROM || 'Angular Agent Framework <hello@cacheplane.io>';
export const NOTIFY_TO = process.env.RESEND_NOTIFY_TO || 'hello@cacheplane.io';

/** Add a contact to the Resend audience. Fails silently. */
export async function addToAudience(email: string, firstName?: string) {
  if (!AUDIENCE_ID) return;
  try {
    await resend.contacts.create({
      audienceId: AUDIENCE_ID,
      email,
      firstName: firstName || undefined,
    });
  } catch (err) {
    console.error('[resend] addToAudience failed:', err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/lib/resend.ts
git commit -m "feat: add shared resend module with audience helper"
```

---

### Task 3: Create lead notification email template

**Files:**
- Create: `apps/website/emails/lead-notification.tsx`

- [ ] **Step 1: Create the template**

Create `apps/website/emails/lead-notification.tsx`:

```tsx
import {
  Html, Head, Body, Container, Section, Text, Hr,
} from '@react-email/components';

interface LeadNotificationProps {
  name: string;
  email: string;
  company: string;
  message: string;
  ts: string;
}

export default function LeadNotification({ name, email, company, message, ts }: LeadNotificationProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#f4f4f5', padding: '40px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', backgroundColor: '#fff', borderRadius: 12, padding: '32px 40px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#004090', fontWeight: 700 }}>
            New Lead
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '8px 0 4px' }}>
            {name}
          </Text>
          <Text style={{ fontSize: 14, color: '#71717a', margin: '0 0 16px' }}>
            {email}{company ? ` — ${company}` : ''}
          </Text>
          {message && (
            <>
              <Hr style={{ borderColor: '#e4e4e7', margin: '16px 0' }} />
              <Text style={{ fontSize: 14, color: '#3f3f46', lineHeight: '1.6' }}>
                {message}
              </Text>
            </>
          )}
          <Hr style={{ borderColor: '#e4e4e7', margin: '16px 0' }} />
          <Text style={{ fontSize: 11, color: '#a1a1aa' }}>
            Received {ts}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/emails/lead-notification.tsx
git commit -m "feat: add lead notification email template"
```

---

### Task 4: Create white paper download email template

**Files:**
- Create: `apps/website/emails/whitepaper-download.tsx`

- [ ] **Step 1: Create the template**

Create `apps/website/emails/whitepaper-download.tsx`:

```tsx
import {
  Html, Head, Body, Container, Section, Text, Button, Hr,
} from '@react-email/components';

interface WhitepaperDownloadProps {
  name?: string;
}

const DOWNLOAD_URL = 'https://cacheplane.ai/whitepaper.pdf';

export default function WhitepaperDownload({ name }: WhitepaperDownloadProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#f4f4f5', padding: '40px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', backgroundColor: '#fff', borderRadius: 12, padding: '32px 40px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#004090', fontWeight: 700 }}>
            Angular Agent Framework
          </Text>
          <Text style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '12px 0 8px' }}>
            Your Angular Agent Readiness Guide
          </Text>
          <Text style={{ fontSize: 14, color: '#3f3f46', lineHeight: '1.6', margin: '0 0 24px' }}>
            {name ? `Hi ${name}, t` : 'T'}he guide covers six production-readiness dimensions: streaming state, thread persistence,
            tool-call rendering, human approval flows, generative UI, and deterministic testing.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
            <Button href={DOWNLOAD_URL} style={{
              backgroundColor: '#004090', color: '#fff', padding: '14px 32px',
              borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}>
              Download the Guide
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e4e4e7', margin: '16px 0' }} />
          <Text style={{ fontSize: 12, color: '#a1a1aa', lineHeight: '1.5' }}>
            Angular Agent Framework — Signal-native streaming for LangGraph.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/emails/whitepaper-download.tsx
git commit -m "feat: add whitepaper download email template"
```

---

### Task 5: Create newsletter welcome email template

**Files:**
- Create: `apps/website/emails/newsletter-welcome.tsx`

- [ ] **Step 1: Create the template**

Create `apps/website/emails/newsletter-welcome.tsx`:

```tsx
import {
  Html, Head, Body, Container, Text, Button, Hr,
} from '@react-email/components';

export default function NewsletterWelcome() {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#f4f4f5', padding: '40px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', backgroundColor: '#fff', borderRadius: 12, padding: '32px 40px', border: '1px solid #e4e4e7' }}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#004090', fontWeight: 700 }}>
            Angular Agent Framework
          </Text>
          <Text style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '12px 0 8px' }}>
            Welcome to Angular Agent Framework updates
          </Text>
          <Text style={{ fontSize: 14, color: '#3f3f46', lineHeight: '1.6', margin: '0 0 24px' }}>
            You'll receive updates on new capabilities, production patterns, and Angular agent best practices.
            We keep it focused and infrequent — no spam.
          </Text>
          <Button href="https://cacheplane.ai/docs" style={{
            backgroundColor: '#004090', color: '#fff', padding: '12px 28px',
            borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            Explore the Docs
          </Button>
          <Hr style={{ borderColor: '#e4e4e7', margin: '24px 0 16px' }} />
          <Text style={{ fontSize: 12, color: '#a1a1aa', lineHeight: '1.5' }}>
            Angular Agent Framework — Signal-native streaming for LangGraph.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/emails/newsletter-welcome.tsx
git commit -m "feat: add newsletter welcome email template"
```

---

### Task 6: Upgrade `/api/leads` route

**Files:**
- Modify: `apps/website/src/app/api/leads/route.ts`

- [ ] **Step 1: Rewrite the route with Resend integration**

Replace the full contents of `apps/website/src/app/api/leads/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resend, FROM, NOTIFY_TO, addToAudience } from '../../../../lib/resend';
import LeadNotification from '../../../../emails/lead-notification';

const LEADS_FILE = path.join(process.cwd(), 'data', 'leads.ndjson');

export async function POST(req: NextRequest) {
  const body = await req.json() as { name?: unknown; email?: unknown; company?: unknown; message?: unknown };
  const sanitize = (v: unknown, max = 500): string =>
    typeof v === 'string' ? v.slice(0, max).trim() : '';

  const name = sanitize(body.name, 200);
  const email = sanitize(body.email, 320);
  const company = sanitize(body.company, 200);
  const message = sanitize(body.message, 2000);

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email required' }, { status: 400 });
  }

  const ts = new Date().toISOString();

  // NDJSON backup (always writes, even if Resend fails)
  try {
    fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
    fs.appendFileSync(LEADS_FILE, JSON.stringify({ name, email, company, message, ts }) + '\n', 'utf8');
  } catch (err) {
    console.error('[leads] NDJSON write failed:', err);
  }

  // Resend: email notification + audience (best-effort)
  try {
    await Promise.all([
      resend.emails.send({
        from: FROM,
        to: NOTIFY_TO,
        subject: `New lead: ${name}${company ? ` at ${company}` : ''}`,
        react: LeadNotification({ name, email, company, message, ts }),
      }),
      addToAudience(email, name),
    ]);
  } catch (err) {
    console.error('[resend] lead notification failed:', err);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Test manually**

Start the dev server and submit the lead form on the pricing page. Check:
1. `data/leads.ndjson` has a new entry
2. Resend dashboard shows a sent email (or check your inbox)
3. Resend audience has the new contact

If `RESEND_API_KEY` is not set, the form should still return `{ ok: true }` and write NDJSON.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/api/leads/route.ts
git commit -m "feat: wire /api/leads to Resend email + audience"
```

---

### Task 7: Upgrade `/api/whitepaper-signup` route

**Files:**
- Modify: `apps/website/src/app/api/whitepaper-signup/route.ts`

- [ ] **Step 1: Rewrite the route with Resend integration**

Replace the full contents of `apps/website/src/app/api/whitepaper-signup/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resend, FROM, addToAudience } from '../../../../lib/resend';
import WhitepaperDownload from '../../../../emails/whitepaper-download';

const SIGNUPS_FILE = path.join(process.cwd(), 'data', 'whitepaper-signups.ndjson');

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // NDJSON backup
  try {
    fs.mkdirSync(path.dirname(SIGNUPS_FILE), { recursive: true });
    fs.appendFileSync(SIGNUPS_FILE, JSON.stringify({ name, email, ts: new Date().toISOString() }) + '\n', 'utf8');
  } catch (err) {
    console.error('[whitepaper] NDJSON write failed:', err);
  }

  // Resend: send PDF download email + add to audience (best-effort)
  try {
    await Promise.all([
      resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Your Angular Agent Readiness Guide',
        react: WhitepaperDownload({ name: name || undefined }),
      }),
      addToAudience(email, name || undefined),
    ]);
  } catch (err) {
    console.error('[resend] whitepaper email failed:', err);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Test manually**

Submit the white paper form on the home page. Check:
1. `data/whitepaper-signups.ndjson` has a new entry
2. The email you submitted receives the "Your Angular Agent Readiness Guide" email with download button
3. Resend audience has the new contact

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/api/whitepaper-signup/route.ts
git commit -m "feat: wire /api/whitepaper-signup to Resend email delivery"
```

---

### Task 8: Create `/api/newsletter` route

**Files:**
- Create: `apps/website/src/app/api/newsletter/route.ts`

- [ ] **Step 1: Create the route**

Create `apps/website/src/app/api/newsletter/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { resend, FROM, addToAudience } from '../../../../lib/resend';
import NewsletterWelcome from '../../../../emails/newsletter-welcome';

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email || '').trim().slice(0, 320);

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Resend: welcome email + audience (best-effort)
  try {
    await Promise.all([
      resend.emails.send({
        from: FROM,
        to: email,
        subject: 'Welcome to Angular Agent Framework updates',
        react: NewsletterWelcome(),
      }),
      addToAudience(email),
    ]);
  } catch (err) {
    console.error('[resend] newsletter signup failed:', err);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/app/api/newsletter/route.ts
git commit -m "feat: add /api/newsletter route with Resend welcome email"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Verify all three routes**

Start the dev server:
```bash
npx nx serve website
```

Test each form:

1. **Pricing page lead form** (`/pricing#lead-form`): Fill name, email, company → submit → check inbox for "New lead" notification
2. **Home page white paper form**: Fill email → submit → check inbox for "Your Angular Agent Readiness Guide" with download link
3. **Direct download**: Click "or download directly" → PDF downloads without form
4. Newsletter route will be testable after Spec 1 adds the footer form. For now, test via curl:

```bash
curl -X POST http://localhost:3000/api/newsletter \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'
```

- [ ] **Step 2: Verify error resilience**

Temporarily set `RESEND_API_KEY=invalid` in `.env.local`. Submit a form. Verify:
- Form returns `{ ok: true }` (no error shown to user)
- NDJSON files still contain the entry
- Console shows `[resend]` error log

- [ ] **Step 3: Verify Resend audience**

Check https://resend.com/audiences — all submitted emails should appear as contacts.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
