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

export function renderFulfillmentTemplate(
  candidate: unknown
): RecipientTemplate {
  const input = FulfillmentTemplateInputSchema.parse(candidate);

  switch (input.context) {
    case 'whitepaper': {
      const paper = WHITEPAPERS[input.paper];
      return {
        subject: paper.subject,
        body: `Here is the guide you requested:\n\n${paper.url}`,
      };
    }
    case 'newsletter':
      return {
        subject: 'Welcome to Threadplane',
        body: 'Thanks for signing up. I’ll keep these notes focused on practical engineering work with agent interfaces.',
      };
    case 'contact':
      return {
        subject: 'Your contact request',
        body: 'Thanks for reaching out. I’ll reply to the contact request you submitted.',
      };
    case 'pricing':
      return {
        subject: 'Your pricing request',
        body: 'Thanks for reaching out. I’ll reply to the pricing request you submitted.',
      };
    case 'project-connect': {
      const facts = input.claimedSignals.map((signal) => PROJECT_FACTS[signal]);
      const joinedFacts =
        facts.length === 1
          ? facts[0]
          : `${facts.slice(0, -1).join(', ')}, and ${facts.at(-1)}`;
      return {
        subject: 'Your connected Threadplane project',
        body: `Thanks for explicitly connecting your project. In that connection, you shared that you ${joinedFacts}. I’ll keep any follow-up to that context.`,
      };
    }
  }
}
