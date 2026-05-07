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
import { captureWhitepaperConversion } from '../../../lib/analytics/server';
import { getSourcePage } from '../../../lib/analytics/properties';

const SIGNUPS_FILE = path.join(process.cwd(), 'data', 'whitepaper-signups.ndjson');

const VALID_PAPERS: PaperId[] = ['overview', 'angular', 'render', 'chat'];

const RESPONSE_EMAILS: Record<PaperId, (name?: string) => string> = {
  overview: whitepaperDownloadHtml,
  angular: angularDownloadHtml,
  render: renderDownloadHtml,
  chat: chatDownloadHtml,
};

const RESPONSE_SUBJECTS: Record<PaperId, string> = {
  overview: 'You are on the Angular Agent Readiness Guide update list',
  angular: 'You are on the Agent Streaming Guide update list',
  render: 'You are on the Generative UI Guide update list',
  chat: 'You are on the Agent Chat Guide update list',
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
  const sourcePage = getSourcePage(req.headers.get('referer'));

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

  // Send confirmation + schedule drip + sync contacts (best-effort)
  try {
    const responseHtml = RESPONSE_EMAILS[paper](name || undefined);
    await Promise.all([
      sendEmail({
        from: FROM,
        to: email,
        subject: RESPONSE_SUBJECTS[paper],
        html: responseHtml,
      }),
      scheduleWhitepaperDrip(email, paper),
      addToAudience(email, name || undefined),
      loopsUpsertContact({ email, firstName: name || undefined, source: `whitepaper-${paper}` }),
      loopsSendEvent({ email, eventName: 'whitepaper_signup', properties: { paper } }),
    ]);
  } catch (err) {
    console.error('[whitepaper-signup] email pipeline failed:', err);
  }

  await captureWhitepaperConversion({ email, paper, sourcePage });

  return NextResponse.json({ ok: true });
}
