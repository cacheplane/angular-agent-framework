import { wrapEmail, esc } from './email-wrapper';

const DOWNLOAD_URL = 'https://cacheplane.ai/whitepapers/render.pdf';

export function renderDownloadHtml(name?: string): string {
  return wrapEmail({
    body: `
      <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 8px;line-height:1.3">Your Enterprise Guide to Generative UI</p>
      <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">${name ? `Hi ${esc(name)}, t` : 'T'}he guide covers five chapters: the coupling problem, declarative UI specs with Vercel's json-render standard, the component registry, streaming JSON patches, and state management.</p>
      <div style="text-align:center;margin:0 0 4px">
        <a href="${DOWNLOAD_URL}" style="display:inline-block;background-color:#1a7a40;color:#fff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Download the Guide</a>
      </div>
    `,
  });
}
