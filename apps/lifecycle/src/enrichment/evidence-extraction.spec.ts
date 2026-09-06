import { describe, expect, it } from 'vitest';

import { extractEvidence } from './company-fetch.js';

const extract = (html: string) =>
  extractEvidence(new TextEncoder().encode(html));

describe('company evidence content selection', () => {
  it('excludes unmarked header link lists without removing hero headings or paragraphs', () => {
    expect(
      extract(
        '<header><h1>Email for developers</h1><div><ul><li><button>Features</button></li><li><a href="/ai">AI</a></li></ul></div><p>Transactional email infrastructure.</p></header><section><ul><li>Email APIs with delivery webhooks.</li></ul></section>'
      )
    ).toEqual({
      facts: ['Email for developers'],
      snippets: [
        'Transactional email infrastructure.',
        'Email APIs with delivery webhooks.',
      ],
    });
  });

  it.each(['footer', 'div role="contentinfo"'])(
    'excludes unmarked footer link groups in %s while retaining company metadata',
    (tag) => {
      const close = tag.split(' ')[0];
      expect(
        extract(
          `<title>Email for developers</title><${tag}><div><p>Features</p><ul><li><a href="/ai">AI</a></li></ul></div></${close}>`
        )
      ).toEqual({
        facts: ['Email for developers'],
        snippets: [],
      });
    }
  );

  it('keeps navigation from consuming the snippet budget before product content', () => {
    expect(
      extract(
        `<nav><ul>${['Features', 'Company', 'Enterprise', 'Help', 'Docs', 'AI']
          .map((label) => `<li><a href="/">${label}</a></li>`)
          .join(
            ''
          )}</ul></nav><main><p>Deliver transactional and marketing emails at scale.</p><ul><li>Track delivery events with webhooks.</li></ul></main>`
      ).snippets
    ).toEqual([
      'Deliver transactional and marketing emails at scale.',
      'Track delivery events with webhooks.',
    ]);
  });

  it.each(['navigation', 'menu', 'menubar', 'NAVIGATION'])(
    'excludes %s subtrees even inside an evidence element',
    (role) => {
      expect(
        extract(
          `<main><li>Serverless compute.<span role="${role}"><span>AI</span></span></li><div role="${role}"><p>Enterprise</p></div></main>`
        ).snippets
      ).toEqual(['Serverless compute.']);
    }
  );

  it('prefers main content over surrounding body copy while keeping hero facts', () => {
    expect(
      extract(
        '<title>Example</title><header><h1>Serverless email</h1><p>Header copy.</p></header><main><p>Deliver email through an API.</p></main><footer><p>Legal copy.</p></footer>'
      )
    ).toEqual({
      facts: ['Example', 'Serverless email'],
      snippets: ['Deliver email through an API.'],
    });
  });

  it('falls back to body content when main has no eligible text', () => {
    expect(
      extract(
        '<header><h1>Example</h1><p>Production email infrastructure.</p></header><main><nav><p>AI</p></nav></main>'
      ).snippets
    ).toEqual(['Production email infrastructure.']);
  });

  it('preserves meaningful paragraphs and product lists without a main landmark', () => {
    expect(
      extract(
        '<nav><p>AI</p></nav><section><p>Production email infrastructure.</p><ul><li>Transactional email APIs.</li></ul></section>'
      ).snippets
    ).toEqual([
      'Production email infrastructure.',
      'Transactional email APIs.',
    ]);
  });

  it('returns no evidence for navigation alone', () => {
    expect(extract('<nav><h1>Products</h1><ul><li>AI</li></ul></nav>')).toEqual(
      { facts: [], snippets: [] }
    );
  });

  it('deduplicates and bounds snippets across main landmarks', () => {
    expect(
      extract(
        `<main><p>First fact.</p></main><main><p>First fact.</p>${Array.from(
          { length: 8 },
          (_, i) => `<li>Product feature ${i}.</li>`
        ).join('')}</main>`
      ).snippets
    ).toEqual([
      'First fact.',
      ...Array.from({ length: 5 }, (_, i) => `Product feature ${i}.`),
    ]);
  });
});
