import { wrapEmail } from './email-wrapper';

export function dripWhitepaperFollowupHtml(day: number): { subject: string; html: string } {
  if (day === 2) {
    return {
      subject: 'Did you get a chance to read Chapter 3?',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Whitepaper Follow-up</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Did you get a chance to read Chapter 3?</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">Chapter 3 covers <strong>tool-call rendering</strong> — how to surface agent actions as real UI instead of raw JSON. It's the chapter most teams bookmark first.</p>
          <a href="https://cacheplane.ai/whitepaper.pdf" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Read the Guide →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 5) {
    return {
      subject: 'The gap between demo and production',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Production Readiness</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">The gap between demo and production</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">Half of GenAI projects die after proof of concept. The gap isn't the model — it's the frontend production path: streaming state, thread persistence, human approval flows, and deterministic testing.</p>
          <a href="https://cacheplane.ai/docs" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">See How It Works →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 10) {
    return {
      subject: 'The pilot program is included with every app license',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Pilot Program</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">The pilot program is included with every app license</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 14px">Every app deployment license includes a <strong>3-month co-pilot engagement</strong> — we work alongside your Angular team to ship your first agent to production.</p>
          <div style="background:#f8f9fc;border-radius:8px;padding:16px 18px;margin:0 0 24px;border:1px solid rgba(0,64,144,0.08)">
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#004090">Week 1</strong> · Integration &amp; first stream</p>
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#004090">Month 1</strong> · First agent in staging</p>
            <p style="font-size:13px;color:#555770;margin:0;line-height:1.6"><strong style="color:#004090">Month 3</strong> · Production deployment</p>
          </div>
          <a href="https://cacheplane.ai/pilot-to-prod" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Learn About the Pilot →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  // day === 20
  return {
    subject: "Ready to ship your agent? Let's talk.",
    html: wrapEmail({
      body: `
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Let's Connect</p>
        <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Ready to ship your agent? Let's talk.</p>
        <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">If your team is evaluating how to take an Angular + LangGraph agent to production, I'd love to hear what you're building. Reply to this email or <a href="mailto:hello@cacheplane.io" style="color:#004090;text-decoration:underline">schedule a conversation</a> — no pitch, just a technical discussion about your use case.</p>
      `,
      showUnsubscribe: true,
    }),
  };
}
