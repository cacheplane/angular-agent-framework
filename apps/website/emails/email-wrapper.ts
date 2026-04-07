/**
 * Shared HTML wrapper for all email templates.
 * Gradient header band with logo, white body, footer.
 */
export function wrapEmail(opts: {
  body: string;
  showUnsubscribe?: boolean;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background-color:#e8eaf0;padding:40px 0;margin:0">
<div style="max-width:520px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%);padding:28px 32px 20px;border-bottom:1px solid rgba(0,64,144,0.1)">
    <div style="font-size:13px;font-weight:700;color:#1a1a2e;letter-spacing:-0.01em">🛩️ Angular Agent Framework</div>
  </div>
  <div style="background:#fff;padding:28px 32px 32px">
    ${opts.body}
    <div style="border-top:1px solid #e4e4e7;margin-top:28px;padding-top:16px">
      <p style="font-size:11px;color:#a1a1aa;line-height:1.5;margin:0">Angular Agent Framework — Signal-native streaming for LangGraph.</p>
      ${opts.showUnsubscribe ? '<p style="font-size:10px;color:#d4d4d8;margin:6px 0 0"><a href="https://stream-resource.dev/api/unsubscribe?email=RECIPIENT" style="color:#d4d4d8;text-decoration:underline">Unsubscribe</a></p>' : ''}
    </div>
  </div>
</div>
</body></html>`;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
