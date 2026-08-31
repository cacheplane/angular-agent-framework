'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { trackCtaClick } from '../../lib/analytics/client';

interface YesRow {
  question: string;
  api: string;
}

interface YesGroup {
  label: string;
  rows: YesRow[];
}

export const YES_WALL_GROUPS: readonly YesGroup[] = [
  {
    label: 'State that survives',
    rows: [
      { question: 'Can a conversation survive a page reload?', api: 'threadId + durable transports' },
      { question: 'Can I resume a thread days later, on another device?', api: 'checkpointed threads' },
      { question: 'Can I branch or replay a conversation from any point?', api: 'branch / replay' },
      { question: 'Can I persist threads without building a persistence layer?', api: 'durable transports' },
    ],
  },
  {
    label: 'Humans in the loop',
    rows: [
      { question: 'Can I stop the agent before it does something irreversible?', api: 'interrupt()' },
      { question: 'Can the pause survive a refresh while someone decides?', api: 'the pause is a checkpoint' },
      { question: 'Can I show the human what the agent is about to do?', api: '<chat-interrupt-panel>' },
      { question: "Can the human's decision land in the thread record?", api: 'submit({ resume })' },
    ],
  },
  {
    label: 'On my design system',
    rows: [
      { question: 'Can agent output render as my components, not a chat widget?', api: '@threadplane/render' },
      { question: 'Can I fall back per-component when a spec is unknown?', api: 'fallback + readiness gate' },
      { question: 'Can the browser own its own tools and render them inline?', api: 'client tools' },
    ],
  },
  {
    label: 'Shipping it',
    rows: [
      { question: 'Can I swap LangGraph for AG-UI without rewriting the UI?', api: 'one Agent contract' },
      { question: 'Can I unit-test components that depend on an agent?', api: 'provideFakeAgent' },
      { question: 'Can I run all of it inside my own VPC?', api: 'self-host, no runtime SaaS' },
      { question: 'Can I use every package commercially without a license fee?', api: 'MIT, all packages' },
      { question: 'Can I install it without phoning home?', api: 'installation is inert' },
    ],
  },
];

const TOTAL_QUESTIONS = YES_WALL_GROUPS.reduce((n, g) => n + g.rows.length, 0);

export function YesWall() {
  return (
    <Section surface="dark" id="yes-wall" ariaLabelledBy="yes-wall-heading">
      <Container>
        <div className="yes-wall">
          <div className="yes-wall-watermark" aria-hidden="true" data-watermark-text="Yes" />
          <div className="yes-wall-grid">
            <SectionHeader
              variant="rail"
              eyebrow="Every question below has the same answer"
              heading="Yes, it does that."
              headingId="yes-wall-heading"
              aside="Sixteen questions teams ask before they commit — each linked to the API that answers it."
            />
            <div className="yes-wall-body">
              {YES_WALL_GROUPS.map((group, index) => (
                <div className="yes-wall-group" key={group.label}>
                  <div className="yes-wall-group-numeral" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="yes-wall-group-rows">
                    <h3 className="yes-wall-group-label">{group.label}</h3>
                    {group.rows.map((row) => (
                      <div className="yes-wall-row" key={row.question}>
                        <p className="yes-wall-question">{row.question}</p>
                        <em className="yes-wall-yes">Yes</em>
                        <p className="yes-wall-api">{row.api}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="yes-wall-footer">
                <a
                  className="yes-wall-footer-link"
                  href="/docs"
                  onClick={() =>
                    trackCtaClick({
                      surface: 'home',
                      destination_url: '/docs',
                      cta_id: 'home_yes_wall_docs',
                      cta_text: 'Every question answered, in the docs',
                    })
                  }
                >
                  Every question answered, in the docs →
                </a>
                <p className="yes-wall-footer-count">{TOTAL_QUESTIONS} questions · {TOTAL_QUESTIONS} yeses</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
