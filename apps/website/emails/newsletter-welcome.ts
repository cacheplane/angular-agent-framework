import { wrapEmail } from './email-wrapper';

export function newsletterWelcomeHtml(): string {
  return wrapEmail({
    body: `
      <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 8px;line-height:1.3">Welcome to Angular Agent Framework updates</p>
      <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">You'll receive updates on new capabilities, production patterns, and Angular agent best practices. We keep it focused and infrequent — no spam.</p>
      <a href="https://stream-resource.dev/docs" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Explore the Docs</a>
    `,
  });
}
