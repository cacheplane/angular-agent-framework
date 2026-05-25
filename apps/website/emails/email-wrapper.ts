/**
 * Shared HTML wrapper for all email templates.
 *
 * Brand pass: drops the pastel gradient header band (legacy aesthetic) for
 * a clean white card with hairline borders, matching the Statusbrew-inspired
 * marketing surface. Inline-only styles for cross-client compatibility.
 */
export function wrapEmail(opts: {
  body: string;
  showUnsubscribe?: boolean;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background-color:#f4f6fb;padding:40px 16px;margin:0">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e8ee;border-radius:14px;overflow:hidden">
  <div style="padding:20px 32px;border-bottom:1px solid #e6e8ee">
    <div style="font-size:14px;font-weight:700;color:#1a1a2e;letter-spacing:-0.01em">🛩️ Threadplane</div>
  </div>
  <div style="padding:32px">
    ${opts.body}
    <div style="border-top:1px solid #e6e8ee;margin-top:28px;padding-top:16px">
      <p style="font-size:11px;color:#8b8fa3;line-height:1.5;margin:0">Threadplane — Production-ready chat, threads, and generative UI for AI agents.</p>
      ${opts.showUnsubscribe ? '<p style="font-size:10px;color:#8b8fa3;margin:6px 0 0"><a href="https://threadplane.ai/api/unsubscribe?email=RECIPIENT" style="color:#8b8fa3;text-decoration:underline">Unsubscribe</a></p>' : ''}
    </div>
  </div>
</div>
</body></html>`;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
