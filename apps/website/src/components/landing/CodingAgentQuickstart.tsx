'use client';

import { useState } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import { CODING_AGENT_PROMPT, INSTALL_OPTIONS } from '../../lib/positioning';

const LINKS = [
  { label: 'Read AGENTS.md', href: '/AGENTS.md' },
  { label: 'Open the full agent reference', href: '/llms-full.txt' },
  { label: 'Start the human quickstart', href: INSTALL_OPTIONS[0].quickstartHref },
];

export function CodingAgentQuickstart() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    trackCtaClick({ cta_id: 'home_coding_agent_prompt', track: 'developer', surface: 'home' });
    try {
      await navigator.clipboard?.writeText(CODING_AGENT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the prompt is visible on the page; the reader can select it */
    }
  };

  return (
    <Section surface="tinted" id="coding-agent" ariaLabelledBy="coding-agent-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="For coding agents"
          heading="Give your coding agent the Angular agent UI playbook."
          headingId="coding-agent-heading"
          aside="Threadplane publishes maintained, machine-readable setup context. Start with a fake agent, verify the Angular surface, then connect LangGraph or AG-UI."
        />
        <pre className="coding-agent-prompt">
          <code data-testid="coding-agent-prompt">{CODING_AGENT_PROMPT}</code>
        </pre>
        <div className="coding-agent-actions">
          <Button variant="primary" size="md" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy setup prompt'}
          </Button>
          {LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="md"
              href={link.href}
              onClick={() =>
                trackCtaClick({
                  cta_id: 'home_coding_agent_link',
                  cta_text: link.label,
                  track: 'developer',
                  surface: 'home',
                })
              }
            >
              {link.label}
            </Button>
          ))}
        </div>
      </Container>
    </Section>
  );
}
