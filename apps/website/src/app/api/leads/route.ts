import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sendEmail, FROM, NOTIFY_TO, addToAudience } from '../../../../lib/resend';
import { leadNotificationHtml } from '../../../../emails/lead-notification';

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
      sendEmail({
        from: FROM,
        to: NOTIFY_TO,
        subject: `New lead: ${name}${company ? ` at ${company}` : ''}`,
        html: leadNotificationHtml({ name, email, company, message, ts }),
      }),
      addToAudience(email, name),
    ]);
  } catch (err) {
    console.error('[resend] lead notification failed:', err);
  }

  return NextResponse.json({ ok: true });
}
