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
        subject: 'Welcome to Angular Stream Resource updates',
        react: NewsletterWelcome(),
      }),
      addToAudience(email),
    ]);
  } catch (err) {
    console.error('[resend] newsletter signup failed:', err);
  }

  return NextResponse.json({ ok: true });
}
