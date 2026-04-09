import { wrapEmail } from './email-wrapper';

export function dripChatFollowupHtml(day: number): { subject: string; html: string } {
  if (day === 2) {
    return {
      subject: 'Did you read Chapter 2 on batteries-included components?',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#5a00c8;font-weight:700;margin:0 0 8px">Chat Guide Follow-up</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Did you read Chapter 2 on batteries-included components?</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">Chapter 2 covers the <strong>batteries-included component library</strong> — message bubbles, streaming indicators, thread lists, and input controls that are pre-wired to LangGraph state. Drop them in and your chat UI works on day one.</p>
          <a href="https://cacheplane.ai/docs" style="display:inline-block;background-color:#5a00c8;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Read the Docs →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 5) {
    return {
      subject: 'The sprint tax: why every team rebuilds chat from scratch',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#5a00c8;font-weight:700;margin:0 0 8px">The Sprint Tax</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">The sprint tax: why every team rebuilds chat from scratch</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">Most teams spend 2–4 sprints building a chat UI before a single agent feature lands. Streaming state management, optimistic updates, thread history, error recovery — it's the same work every time. @cacheplane/chat eliminates the sprint tax so your team ships features from day one.</p>
          <a href="https://cacheplane.ai/chat" style="display:inline-block;background-color:#5a00c8;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">See How It Works →</a>
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
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#5a00c8;font-weight:700;margin:0 0 8px">Pilot Program</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">The pilot program includes hands-on integration</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 14px">Every app deployment license includes a <strong>3-month co-pilot engagement</strong> — we work alongside your Angular team to ship your first agent to production.</p>
          <div style="background:#f8f9fc;border-radius:8px;padding:16px 18px;margin:0 0 24px;border:1px solid rgba(90,0,200,0.08)">
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#5a00c8">Week 1</strong> · Integration &amp; first stream</p>
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#5a00c8">Month 1</strong> · First agent in staging</p>
            <p style="font-size:13px;color:#555770;margin:0;line-height:1.6"><strong style="color:#5a00c8">Month 3</strong> · Production deployment</p>
          </div>
          <a href="https://cacheplane.ai/pilot-to-prod" style="display:inline-block;background-color:#5a00c8;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Learn About the Pilot →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  // day === 20
  return {
    subject: "Ready to ship your agent chat? Let's talk.",
    html: wrapEmail({
      body: `
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#5a00c8;font-weight:700;margin:0 0 8px">Let's Connect</p>
        <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Ready to ship your agent chat? Let's talk.</p>
        <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">If your team is building an agent chat interface and wants to skip the sprint tax, I'd love to hear what you're working on. Reply to this email or <a href="mailto:hello@cacheplane.ai" style="color:#5a00c8;text-decoration:underline">schedule a conversation</a> — no pitch, just a technical discussion about your use case.</p>
      `,
      showUnsubscribe: true,
    }),
  };
}
