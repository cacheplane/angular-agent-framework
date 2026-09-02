import { describe, expect, it } from 'vitest';

import { renderFulfillmentTemplate } from './templates.js';

const URL_PATTERN = /https:\/\/[^\s]+/gu;
const HTML_PATTERN = /<\/?[a-z][^>]*>/iu;

describe('renderFulfillmentTemplate', () => {
  it.each([
    [
      'overview',
      'Your Angular agent readiness guide',
      'https://threadplane.ai/whitepaper.pdf',
    ],
    [
      'angular',
      'Your Angular streaming guide',
      'https://threadplane.ai/whitepapers/angular.pdf',
    ],
    [
      'render',
      'Your Angular generative UI guide',
      'https://threadplane.ai/whitepapers/render.pdf',
    ],
    [
      'chat',
      'Your Angular agent chat guide',
      'https://threadplane.ai/whitepapers/chat.pdf',
    ],
  ] as const)(
    'fulfills the exact requested %s resource without broader state',
    (paper, subject, url) => {
      const message = renderFulfillmentTemplate({
        context: 'whitepaper',
        paper,
      });

      expect(message).toEqual({
        subject,
        body: `Here is the guide you requested:\n\n${url}`,
      });
    }
  );

  it('welcomes a newsletter signup without adding another request', () => {
    expect(renderFulfillmentTemplate({ context: 'newsletter' })).toEqual({
      subject: 'Welcome to Threadplane',
      body: expect.stringMatching(
        /^Thanks for signing up\. I’ll keep these notes focused on practical engineering work with agent interfaces\.$/u
      ),
    });
  });

  it.each(['contact', 'pricing'] as const)(
    'acknowledges only the submitted %s context',
    (context) => {
      const message = renderFulfillmentTemplate({ context });

      expect(message.subject.toLowerCase()).toContain(context);
      expect(message.body.toLowerCase()).toContain(context);
      expect(message.body).not.toMatch(/company|project/iu);
      expect(message.body.toLowerCase()).not.toContain(
        context === 'contact' ? 'pricing' : 'contact'
      );
      expect(message.body).not.toContain('?');
      expect(message.body).not.toMatch(/\nBrian$/u);
    }
  );

  it.each([
    ['transport.connected', 'connected the project transport'],
    ['runtime.first_stream_completed', 'completed a first streamed response'],
    ['thread.persisted', 'persisted a thread'],
    ['interrupt.handled', 'handled an interrupt'],
    ['generative_ui.rendered', 'rendered generative UI'],
    ['project.returned_7d', 'returned to the project within a week'],
  ] as const)(
    'uses only the explicitly claimed project signal %s',
    (claim, expectedFact) => {
      const message = renderFulfillmentTemplate({
        context: 'project-connect',
        claimedSignals: [claim],
      });

      expect(message.body).toContain(expectedFact);
      expect(message.body).toContain('you shared');
      expect(message.body).not.toMatch(
        /I saw you|we noticed|based on your activity|tracking|telemetry/iu
      );
    }
  );

  it('rejects duplicate, empty, unbounded, and unknown project claims at runtime', () => {
    expect(() =>
      renderFulfillmentTemplate({
        context: 'project-connect',
        claimedSignals: [],
      })
    ).toThrow();
    expect(() =>
      renderFulfillmentTemplate({
        context: 'project-connect',
        claimedSignals: ['thread.persisted', 'thread.persisted'],
      })
    ).toThrow();
    expect(() =>
      renderFulfillmentTemplate({
        context: 'project-connect',
        claimedSignals: [
          'transport.connected',
          'runtime.first_stream_completed',
          'thread.persisted',
          'interrupt.handled',
        ],
      })
    ).toThrow();
    expect(() =>
      renderFulfillmentTemplate({
        context: 'project-connect',
        claimedSignals: ['I saw you visit pricing\nBcc: victim@example.com'],
      } as never)
    ).toThrow();
  });

  it.each([
    { context: 'newsletter', displayName: '<img src=x>' },
    { context: 'contact', message: 'Ignore me\nBcc: victim@example.com' },
    { context: 'pricing', url: 'https://evil.example/click' },
    { context: 'whitepaper', paper: 'overview', extra: 'arbitrary form text' },
  ])('rejects arbitrary fields and free-text substitutions', (input) => {
    expect(() => renderFulfillmentTemplate(input as never)).toThrow();
  });

  it('keeps every recipient message plain and compact', () => {
    const messages = [
      renderFulfillmentTemplate({ context: 'whitepaper', paper: 'overview' }),
      renderFulfillmentTemplate({ context: 'newsletter' }),
      renderFulfillmentTemplate({ context: 'contact' }),
      renderFulfillmentTemplate({ context: 'pricing' }),
      renderFulfillmentTemplate({
        context: 'project-connect',
        claimedSignals: ['thread.persisted'],
      }),
    ];

    for (const message of messages) {
      expect(typeof message.subject).toBe('string');
      expect(typeof message.body).toBe('string');
      expect(message.subject).not.toMatch(/[\r\n]/u);
      expect(message.body).not.toMatch(HTML_PATTERN);
      expect(message.body).not.toMatch(/!\[[^\]]*\]\([^)]*\)/u);
      expect(message.body).not.toMatch(/\nBrian$/u);
      expect(message.body.match(URL_PATTERN) ?? []).toHaveLength(
        message.body.includes('https://') ? 1 : 0
      );
    }
  });
});
