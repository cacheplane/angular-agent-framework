import { wrapEmail, esc } from './email-wrapper';

const DOCS_URL = 'https://cacheplane.ai/docs/agent/api/agent';

export function angularDownloadHtml(name?: string): string {
  return wrapEmail({
    body: `
      <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 8px;line-height:1.3">Your Enterprise Guide to Agent Streaming</p>
      <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">${name ? `Hi ${esc(name)}, t` : 'T'}he guide is being refreshed to match the current @ngaf/langgraph API. We will send the updated version when it is ready. In the meantime, start with the current agent() reference.</p>
      <div style="text-align:center;margin:0 0 4px">
        <a href="${DOCS_URL}" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Read the agent() Docs</a>
      </div>
    `,
  });
}
