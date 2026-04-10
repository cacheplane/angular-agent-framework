import { sendEmail, FROM } from './resend';
import { dripWhitepaperFollowupHtml } from '../emails/drip-whitepaper-followup';
import { dripAngularFollowupHtml } from '../emails/drip-angular-followup';
import { dripRenderFollowupHtml } from '../emails/drip-render-followup';
import { dripChatFollowupHtml } from '../emails/drip-chat-followup';

export type PaperId = 'overview' | 'angular' | 'render' | 'chat';

const DRIP_DAYS = [2, 5, 10, 20];

const DRIP_GENERATORS: Record<PaperId, (day: number) => { subject: string; html: string }> = {
  overview: dripWhitepaperFollowupHtml,
  angular: dripAngularFollowupHtml,
  render: dripRenderFollowupHtml,
  chat: dripChatFollowupHtml,
};

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // Send at 9am
  return d.toISOString();
}

/** Schedule the whitepaper drip sequence for a contact. Best-effort. */
export async function scheduleWhitepaperDrip(email: string, paper: PaperId = 'overview') {
  const generator = DRIP_GENERATORS[paper] ?? DRIP_GENERATORS.overview;
  for (const day of DRIP_DAYS) {
    const { subject, html } = generator(day);
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
      console.error(`[drip] Failed to schedule day-${day} ${paper} email for ${email}:`, err);
    }
  }
}
