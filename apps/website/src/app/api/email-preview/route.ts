/**
 * Dev-only email template preview route.
 * Visit /api/email-preview?template=whitepaper-download to preview a template.
 * Available templates: whitepaper-download, newsletter-welcome, lead-notification,
 *   drip-day-2, drip-day-5, drip-day-10, drip-day-20
 */
import { NextRequest, NextResponse } from 'next/server';
import { whitepaperDownloadHtml } from '../../../../emails/whitepaper-download';
import { newsletterWelcomeHtml } from '../../../../emails/newsletter-welcome';
import { leadNotificationHtml } from '../../../../emails/lead-notification';
import { dripWhitepaperFollowupHtml } from '../../../../emails/drip-whitepaper-followup';

const TEMPLATES: Record<string, () => { subject: string; html: string }> = {
  'whitepaper-download': () => ({
    subject: 'Your Angular Agent Readiness Guide',
    html: whitepaperDownloadHtml('Brian'),
  }),
  'newsletter-welcome': () => ({
    subject: 'Welcome to Angular Agent Framework updates',
    html: newsletterWelcomeHtml(),
  }),
  'lead-notification': () => ({
    subject: 'New lead: Brian at Cacheplane',
    html: leadNotificationHtml({
      name: 'Brian Love',
      email: 'brian@cacheplane.io',
      company: 'Cacheplane',
      message: 'Interested in the pilot program for our Angular + LangGraph project.',
      ts: new Date().toISOString(),
    }),
  }),
  'drip-day-2': () => dripWhitepaperFollowupHtml(2),
  'drip-day-5': () => dripWhitepaperFollowupHtml(5),
  'drip-day-10': () => dripWhitepaperFollowupHtml(10),
  'drip-day-20': () => dripWhitepaperFollowupHtml(20),
};

export async function GET(req: NextRequest) {
  const template = req.nextUrl.searchParams.get('template');

  // Index page — show all templates
  if (!template) {
    const links = Object.keys(TEMPLATES).map(
      (t) => `<a href="/api/email-preview?template=${t}" style="display:block;padding:8px 0;color:#004090;font-size:14px">${t}</a>`
    ).join('');

    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Email Previews</title></head>
      <body style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:40px auto;padding:0 20px">
        <h1 style="font-size:24px;font-weight:700;color:#1a1a2e;margin:0 0 8px">Email Template Previews</h1>
        <p style="font-size:14px;color:#71717a;margin:0 0 24px">Click a template to preview it as rendered HTML.</p>
        ${links}
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const factory = TEMPLATES[template];
  if (!factory) {
    return new NextResponse(`Unknown template: ${template}`, { status: 404 });
  }

  const { subject, html } = factory();

  // Wrap in a preview frame showing subject line
  const preview = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview: ${subject}</title></head>
  <body style="margin:0;padding:0;background:#e4e4e7">
    <div style="background:#fff;padding:12px 24px;border-bottom:1px solid #e4e4e7;font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:space-between">
      <div>
        <span style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em">Subject:</span>
        <span style="font-size:14px;font-weight:600;color:#1a1a2e;margin-left:8px">${subject}</span>
      </div>
      <a href="/api/email-preview" style="font-size:12px;color:#004090;text-decoration:none">← All templates</a>
    </div>
    <div style="padding:20px 0">
      ${html}
    </div>
  </body></html>`;

  return new NextResponse(preview, { headers: { 'Content-Type': 'text/html' } });
}
