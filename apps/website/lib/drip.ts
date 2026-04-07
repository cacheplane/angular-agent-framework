import { sendEmail, FROM } from './resend';
import { dripWhitepaperFollowupHtml } from '../emails/drip-whitepaper-followup';

const DRIP_DAYS = [2, 5, 10, 20];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // Send at 9am
  return d.toISOString();
}

/** Schedule the whitepaper drip sequence for a contact. Best-effort. */
export async function scheduleWhitepaperDrip(email: string) {
  for (const day of DRIP_DAYS) {
    const { subject, html } = dripWhitepaperFollowupHtml(day);
    // Replace RECIPIENT placeholder with actual email for unsubscribe link
    const personalizedHtml = html.replace('email=RECIPIENT', `email=${encodeURIComponent(email)}`);
    try {
      await sendEmail({
        from: FROM,
        to: email,
        subject,
        html: personalizedHtml,
        scheduledAt: daysFromNow(day),
      });
    } catch (err) {
      console.error(`[drip] Failed to schedule day-${day} email for ${email}:`, err);
    }
  }
}
