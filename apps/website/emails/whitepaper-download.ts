const DOWNLOAD_URL = 'https://stream-resource.dev/whitepaper.pdf';

export function whitepaperDownloadHtml(name?: string): string {
  return `<!DOCTYPE html><html><head></head>
<body style="font-family:Inter,Arial,sans-serif;background-color:#f4f4f5;padding:40px 0;margin:0">
<div style="max-width:520px;margin:0 auto;background-color:#fff;border-radius:12px;padding:32px 40px;border:1px solid #e4e4e7">
  <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 12px">Angular Stream Resource</p>
  <p style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0 0 8px">Your Angular Agent Readiness Guide</p>
  <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 24px">${name ? `Hi ${esc(name)}, t` : 'T'}he guide covers six production-readiness dimensions: streaming state, thread persistence, tool-call rendering, human approval flows, generative UI, and deterministic testing.</p>
  <div style="text-align:center;margin:0 0 24px">
    <a href="${DOWNLOAD_URL}" style="background-color:#004090;color:#fff;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;display:inline-block">Download the Guide</a>
  </div>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0"/>
  <p style="font-size:12px;color:#a1a1aa;line-height:1.5;margin:0">Angular Stream Resource — Signal-native streaming for LangGraph.</p>
</div></body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
