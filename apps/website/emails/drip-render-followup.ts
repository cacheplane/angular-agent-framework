import { wrapEmail } from './email-wrapper';

export function dripRenderFollowupHtml(day: number): { subject: string; html: string } {
  if (day === 2) {
    return {
      subject: 'Did you read Chapter 2 on declarative UI specs?',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#1a7a40;font-weight:700;margin:0 0 8px">Render Guide Follow-up</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Did you read Chapter 2 on declarative UI specs?</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">Chapter 2 covers <strong>declarative UI specs</strong> — how agents emit structured JSON that maps directly to your component registry instead of generating raw HTML. It's the foundation that makes generative UI predictable and testable.</p>
          <a href="https://cacheplane.ai/docs" style="display:inline-block;background-color:#1a7a40;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Read the Docs →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 5) {
    return {
      subject: 'Why tight coupling between agents and UI kills iteration speed',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#1a7a40;font-weight:700;margin:0 0 8px">Architecture</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Why tight coupling between agents and UI kills iteration speed</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">When an agent generates UI directly — raw HTML, string templates, hardcoded component names — every model change breaks the frontend and every UI change breaks the prompt. Decoupling via a declarative spec layer means agents and UI teams can iterate independently. See how @ngaf/render makes this the default.</p>
          <a href="https://cacheplane.ai/render" style="display:inline-block;background-color:#1a7a40;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">See How It Works →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 10) {
    return {
      subject: 'The pilot program includes hands-on integration',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#1a7a40;font-weight:700;margin:0 0 8px">Pilot Program</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">The pilot program includes hands-on integration</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 14px">Every app deployment license includes a <strong>3-month co-pilot engagement</strong> — we work alongside your Angular team to ship your first agent to production.</p>
          <div style="background:#f8f9fc;border-radius:8px;padding:16px 18px;margin:0 0 24px;border:1px solid rgba(26,122,64,0.08)">
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#1a7a40">Week 1</strong> · Integration &amp; first stream</p>
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#1a7a40">Month 1</strong> · First agent in staging</p>
            <p style="font-size:13px;color:#555770;margin:0;line-height:1.6"><strong style="color:#1a7a40">Month 3</strong> · Production deployment</p>
          </div>
          <a href="https://cacheplane.ai/pilot-to-prod" style="display:inline-block;background-color:#1a7a40;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Learn About the Pilot →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  // day === 20
  return {
    subject: "Ready to decouple your agent UI? Let's talk.",
    html: wrapEmail({
      body: `
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#1a7a40;font-weight:700;margin:0 0 8px">Let's Connect</p>
        <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Ready to decouple your agent UI? Let's talk.</p>
        <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">If your team is evaluating how to make generative UI predictable and maintainable in production, I'd love to hear what you're building. Reply to this email or <a href="mailto:hello@cacheplane.ai" style="color:#1a7a40;text-decoration:underline">schedule a conversation</a> — no pitch, just a technical discussion about your use case.</p>
      `,
      showUnsubscribe: true,
    }),
  };
}
