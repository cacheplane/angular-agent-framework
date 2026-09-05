import { z } from 'zod';

const ProjectSignalSchema = z.enum([
  'transport.connected',
  'runtime.first_stream_completed',
  'thread.persisted',
  'interrupt.handled',
  'generative_ui.rendered',
  'project.returned_7d',
]);

const FulfillmentTemplateInputSchema = z.discriminatedUnion('context', [
  z
    .object({
      context: z.literal('whitepaper'),
      paper: z.enum(['overview', 'angular', 'render', 'chat']),
    })
    .strict(),
  z.object({ context: z.literal('newsletter') }).strict(),
  z.object({ context: z.literal('contact') }).strict(),
  z.object({ context: z.literal('pricing') }).strict(),
  z
    .object({
      context: z.literal('project-connect'),
      claimedSignals: z
        .array(ProjectSignalSchema)
        .min(1)
        .max(3)
        .refine((signals) => new Set(signals).size === signals.length, {
          message: 'claimedSignals must be unique',
        }),
    })
    .strict(),
]);

export type FulfillmentTemplateInput = z.infer<
  typeof FulfillmentTemplateInputSchema
>;

export interface RecipientTemplate {
  readonly subject: string;
  readonly body: string;
}

const WHITEPAPERS = {
  overview: {
    subject: 'Your Angular agent readiness guide',
    url: 'https://threadplane.ai/whitepaper.pdf',
  },
  angular: {
    subject: 'Your Angular streaming guide',
    url: 'https://threadplane.ai/whitepapers/angular.pdf',
  },
  render: {
    subject: 'Your Angular generative UI guide',
    url: 'https://threadplane.ai/whitepapers/render.pdf',
  },
  chat: {
    subject: 'Your Angular agent chat guide',
    url: 'https://threadplane.ai/whitepapers/chat.pdf',
  },
} as const;

const PROJECT_FACTS: Record<z.infer<typeof ProjectSignalSchema>, string> = {
  'transport.connected': 'connected the project transport',
  'runtime.first_stream_completed': 'completed a first streamed response',
  'thread.persisted': 'persisted a thread',
  'interrupt.handled': 'handled an interrupt',
  'generative_ui.rendered': 'rendered generative UI',
  'project.returned_7d': 'returned to the project within a week',
};

/**
 * Recipient copy in Brian's register: no contractions, no "thanks for"
 * openers, one thought per line, no marketing tone. The "Hey <name>,"
 * greeting is added at send time; every body here stays inside the
 * recipient-copy checks in campaign/templates.ts.
 */
export function renderFulfillmentTemplate(
  candidate: unknown
): RecipientTemplate {
  const input = FulfillmentTemplateInputSchema.parse(candidate);

  switch (input.context) {
    case 'whitepaper': {
      const paper = WHITEPAPERS[input.paper];
      return {
        subject: paper.subject,
        body: `Here is the guide you requested:\n${paper.url}\n\nRead it when you have a quiet hour.\nIf something in it does not hold up in your own code, reply and tell me.`,
      };
    }
    case 'newsletter':
      return {
        subject: 'Welcome to Threadplane',
        body: 'You are on the list.\n\nI write these notes about practical engineering work with agent interfaces.\nStreaming, state, interrupts, and the boundaries that make them testable.\nNo hype.\n\nIf one of them misses the mark, reply and tell me.',
      };
    case 'contact':
      return {
        subject: 'Your contact request',
        body: 'I have your contact request.\nI will read it and reply myself.',
      };
    case 'pricing':
      return {
        subject: 'Your pricing request',
        body: 'I have your pricing request.\nI will read it and reply myself.',
      };
    case 'project-connect': {
      const facts = input.claimedSignals.map((signal) => PROJECT_FACTS[signal]);
      const joinedFacts =
        facts.length === 1
          ? facts[0]
          : `${facts.slice(0, -1).join(', ')}, and ${facts.at(-1)}`;
      return {
        subject: 'Your connected Threadplane project',
        body: `You connected your project.\nIn that connection, you shared that you ${joinedFacts}.\n\nI will keep any follow-up to that context.\nNothing else.`,
      };
    }
  }
}
