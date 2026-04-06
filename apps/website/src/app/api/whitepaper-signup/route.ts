import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resend, FROM, addToAudience } from '../../../../lib/resend';
import { whitepaperDownloadHtml } from '../../../../emails/whitepaper-download';

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
        html: whitepaperDownloadHtml(name || undefined),
      }),
      addToAudience(email, name || undefined),
    ]);
  } catch (err) {
    console.error('[resend] whitepaper email failed:', err);
  }

  return NextResponse.json({ ok: true });
}
