import { wrapEmail, esc } from './email-wrapper';

interface LeadNotificationProps {
  name: string;
  email: string;
  company: string;
  message: string;
  ts: string;
}

export function leadNotificationHtml({ name, email, company, message, ts }: LeadNotificationProps): string {
  return wrapEmail({
    body: `
      <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#DD0031;font-weight:700;margin:0 0 8px">New Lead</p>
      <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 4px">${esc(name)}</p>
      <p style="font-size:14px;color:#8b8fa3;margin:0 0 16px">${esc(email)}${company ? ` — ${esc(company)}` : ''}</p>
      ${message ? `<div style="border-top:1px solid #e4e4e7;padding-top:14px;margin-bottom:4px"><p style="font-size:14px;color:#555770;line-height:1.7;margin:0">${esc(message)}</p></div>` : ''}
      <div style="border-top:1px solid #e4e4e7;padding-top:14px;margin-top:14px">
        <p style="font-size:11px;color:#a1a1aa;margin:0">Received ${esc(ts)}</p>
      </div>
    `,
  });
}
