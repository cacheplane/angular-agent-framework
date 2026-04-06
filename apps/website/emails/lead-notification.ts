interface LeadNotificationProps {
  name: string;
  email: string;
  company: string;
  message: string;
  ts: string;
}

export function leadNotificationHtml({ name, email, company, message, ts }: LeadNotificationProps): string {
  return `<!DOCTYPE html><html><head></head>
<body style="font-family:Inter,Arial,sans-serif;background-color:#f4f4f5;padding:40px 0;margin:0">
<div style="max-width:520px;margin:0 auto;background-color:#fff;border-radius:12px;padding:32px 40px;border:1px solid #e4e4e7">
  <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">New Lead</p>
  <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:8px 0 4px">${esc(name)}</p>
  <p style="font-size:14px;color:#71717a;margin:0 0 16px">${esc(email)}${company ? ` — ${esc(company)}` : ''}</p>
  ${message ? `<hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0"/><p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0">${esc(message)}</p>` : ''}
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0"/>
  <p style="font-size:11px;color:#a1a1aa;margin:0">Received ${esc(ts)}</p>
</div></body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
