import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, FROM, addToAudience } from '../../../../lib/resend';
import { loopsUpsertContact, loopsSendEvent } from '../../../../lib/loops';
import { newsletterWelcomeHtml } from '../../../../emails/newsletter-welcome';

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
      sendEmail({
        from: FROM,
        to: email,
        subject: 'Welcome to Angular Agent Framework updates',
        html: newsletterWelcomeHtml(),
      }),
      addToAudience(email),
      loopsUpsertContact({
        email,
        source: 'newsletter',
      }),
      loopsSendEvent({
        email,
        eventName: 'newsletter_subscribed',
      }),
    ]);
  } catch (err) {
    console.error('[resend] newsletter signup failed:', err);
  }

  return NextResponse.json({ ok: true });
}
