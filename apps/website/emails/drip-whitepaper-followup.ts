export function dripWhitepaperFollowupHtml(day: number): { subject: string; html: string } {
  const unsubUrl = 'https://stream-resource.dev/api/unsubscribe';

  if (day === 2) {
    return {
      subject: 'Did you get a chance to read Chapter 3?',
      html: wrapEmail(`
        <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 16px">Chapter 3 covers <strong>tool-call rendering</strong> — how to surface agent actions as real UI instead of raw JSON. It's the chapter most teams bookmark first.</p>
        <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 24px">If you haven't downloaded it yet, <a href="https://stream-resource.dev/whitepaper.pdf" style="color:#004090;text-decoration:underline">grab it here</a>.</p>
      `),
    };
  }
  if (day === 5) {
    return {
      subject: 'The gap between demo and production',
      html: wrapEmail(`
        <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 16px">Half of GenAI projects die after proof of concept. The gap isn't the model — it's the frontend production path: streaming state, thread persistence, human approval flows, and deterministic testing.</p>
        <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 24px">That's exactly what the Angular Agent Framework solves. <a href="https://stream-resource.dev/docs" style="color:#004090;text-decoration:underline">See how it works →</a></p>
      `),
    };
  }
  if (day === 10) {
    return {
      subject: 'The pilot program is included with every app license',
      html: wrapEmail(`
        <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 16px">Every app deployment license includes a <strong>3-month co-pilot engagement</strong> — we work alongside your Angular team to ship your first agent to production.</p>
        <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 8px">Week 1: Integration & first stream<br/>Month 1: First agent in staging<br/>Month 3: Production deployment</p>
        <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:16px 0 24px"><a href="https://stream-resource.dev/pilot-to-prod" style="color:#004090;text-decoration:underline">Learn about the pilot program →</a></p>
      `),
    };
  }
  // day === 20
  return {
    subject: 'Ready to ship your agent? Let\'s talk.',
    html: wrapEmail(`
      <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 16px">If your team is evaluating how to take an Angular + LangGraph agent to production, I'd love to hear what you're building.</p>
      <p style="font-size:14px;color:#3f3f46;line-height:1.6;margin:0 0 24px">Reply to this email or <a href="mailto:hello@cacheplane.io" style="color:#004090;text-decoration:underline">schedule a conversation</a> — no pitch, just a technical discussion about your use case.</p>
    `),
  };
}

function wrapEmail(body: string): string {
  return `<!DOCTYPE html><html><head></head>
<body style="font-family:Inter,Arial,sans-serif;background-color:#f4f4f5;padding:40px 0;margin:0">
<div style="max-width:520px;margin:0 auto;background-color:#fff;border-radius:12px;padding:32px 40px;border:1px solid #e4e4e7">
  <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 16px">Angular Agent Framework</p>
  ${body}
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 16px"/>
  <p style="font-size:11px;color:#a1a1aa;line-height:1.5;margin:0">Angular Agent Framework — Signal-native streaming for LangGraph.</p>
  <p style="font-size:10px;color:#d4d4d8;margin:8px 0 0"><a href="https://stream-resource.dev/api/unsubscribe?email=RECIPIENT" style="color:#d4d4d8;text-decoration:underline">Unsubscribe</a></p>
</div></body></html>`;
}
