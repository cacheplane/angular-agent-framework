import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { sendEmail, FROM, addToAudience } from '../../../../lib/resend';
import { loopsUpsertContact, loopsSendEvent } from '../../../../lib/loops';
import { scheduleWhitepaperDrip, type PaperId } from '../../../../lib/drip';
import { whitepaperDownloadHtml } from '../../../../emails/whitepaper-download';
import { angularDownloadHtml } from '../../../../emails/angular-download';
import { renderDownloadHtml } from '../../../../emails/render-download';
import { chatDownloadHtml } from '../../../../emails/chat-download';

const SIGNUPS_FILE = path.join(process.cwd(), 'data', 'whitepaper-signups.ndjson');

const VALID_PAPERS: PaperId[] = ['overview', 'angular', 'render', 'chat'];

const DOWNLOAD_EMAILS: Record<PaperId, (name?: string) => string> = {
  overview: whitepaperDownloadHtml,
  angular: angularDownloadHtml,
  render: renderDownloadHtml,
  chat: chatDownloadHtml,
};

const DOWNLOAD_SUBJECTS: Record<PaperId, string> = {
  overview: 'Your Angular Agent Readiness Guide',
  angular: 'Your Enterprise Guide to Agent Streaming',
  render: 'Your Enterprise Guide to Generative UI',
  chat: 'Your Enterprise Guide to Agent Chat Interfaces',
};

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; paper?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = (body.name || '').trim().slice(0, 200);
  const email = (body.email || '').trim().slice(0, 320);
  const paper = (VALID_PAPERS.includes(body.paper as PaperId) ? body.paper : 'overview') as PaperId;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Persist signup to NDJSON (always, even if email fails)
  const entry = JSON.stringify({ name, email, paper, ts: new Date().toISOString() }) + '\n';
  try {
    fs.mkdirSync(path.dirname(SIGNUPS_FILE), { recursive: true });
    fs.appendFileSync(SIGNUPS_FILE, entry, 'utf8');
  } catch (err) {
    console.error('Failed to write signup:', err);
  }

  // Send download confirmation + schedule drip + sync contacts (best-effort)
  try {
    const downloadHtml = DOWNLOAD_EMAILS[paper](name || undefined);
    await Promise.all([
      sendEmail({
        from: FROM,
        to: email,
        subject: DOWNLOAD_SUBJECTS[paper],
        html: downloadHtml,
      }),
      scheduleWhitepaperDrip(email, paper),
      addToAudience(email, name || undefined),
      loopsUpsertContact({ email, firstName: name || undefined, source: `whitepaper-${paper}` }),
      loopsSendEvent({ email, eventName: 'whitepaper_downloaded', properties: { paper } }),
    ]);
  } catch (err) {
    console.error('[whitepaper-signup] email pipeline failed:', err);
  }

  return NextResponse.json({ ok: true });
}
