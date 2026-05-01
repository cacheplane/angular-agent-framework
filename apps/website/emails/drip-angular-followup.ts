import { wrapEmail } from './email-wrapper';

export function dripAngularFollowupHtml(day: number): { subject: string; html: string } {
  if (day === 2) {
    return {
      subject: 'Did you read Chapter 2 on the agent() API?',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Angular Guide Follow-up</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Did you read Chapter 2 on the agent() API?</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">Chapter 2 dives into the <strong>agent() API</strong> — the signal-native primitive that connects your Angular component directly to a LangGraph streaming run. It's the chapter most teams bookmark first when they see how little boilerplate is required.</p>
          <a href="https://cacheplane.ai/docs" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Read the Docs →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 5) {
    return {
      subject: 'LangGraph Angular SDK vs @ngaf/langgraph',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Comparison</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">LangGraph Angular SDK vs @ngaf/langgraph</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">The LangGraph JS SDK gives you a streaming client. <strong>@ngaf/langgraph</strong> gives you signal-native state, thread persistence, interrupt flows, and a full test harness — all wired together and optimized for Angular's change detection model. See the full comparison on our product page.</p>
          <a href="https://cacheplane.ai/angular" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">See the Comparison →</a>
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
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Pilot Program</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">The pilot program includes hands-on integration</p>
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
    subject: "Ready to ship your LangGraph agent? Let's talk.",
    html: wrapEmail({
      body: `
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Let's Connect</p>
        <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Ready to ship your LangGraph agent? Let's talk.</p>
        <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">If your team is evaluating how to take an Angular + LangGraph agent to production, I'd love to hear what you're building. Reply to this email or <a href="mailto:hello@cacheplane.ai" style="color:#004090;text-decoration:underline">schedule a conversation</a> — no pitch, just a technical discussion about your use case.</p>
      `,
      showUnsubscribe: true,
    }),
  };
}
