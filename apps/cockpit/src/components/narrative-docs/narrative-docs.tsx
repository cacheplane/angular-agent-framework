'use client';

import React, { useCallback } from 'react';
import { track } from '../../lib/analytics/client';

interface NarrativeDoc {
  title: string;
  html: string;
  sourceFile: string;
}

interface NarrativeDocsProps {
  narrativeDocs: NarrativeDoc[];
  capability?: string;
}

export function NarrativeDocs({ narrativeDocs, capability }: NarrativeDocsProps) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;

    const copyCodeBtn = target.closest('[data-copy-code]') as HTMLElement | null;
    if (copyCodeBtn) {
      const codeBlock = copyCodeBtn.closest('.doc-codeblock');
      const code = codeBlock?.querySelector('pre code')?.textContent ?? '';
      navigator.clipboard.writeText(code);
      track('cockpit:code_copied', { capability, surface: 'docs_code_snippet' });
      copyCodeBtn.textContent = 'Copied!';
      setTimeout(() => { copyCodeBtn.textContent = 'Copy'; }, 1500);
      return;
    }

    const copyPromptBtn = target.closest('[data-copy-prompt]') as HTMLElement | null;
    if (copyPromptBtn) {
      const promptBlock = copyPromptBtn.closest('.doc-prompt');
      const text = promptBlock?.querySelector('.doc-prompt__content')?.textContent ?? '';
      navigator.clipboard.writeText(text);
      track('cockpit:code_copied', { capability, surface: 'agentic_prompt' });
      copyPromptBtn.textContent = 'Copied!';
      setTimeout(() => { copyPromptBtn.textContent = 'Copy prompt'; }, 1500);
      return;
    }
  }, [capability]);

  if (narrativeDocs.length === 0) {
    return (
      <section aria-label="Docs mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>No documentation available for this capability.</p>
      </section>
    );
  }

  return (
    <section aria-label="Docs mode" className="h-full overflow-auto py-6 px-4 md:px-8">
      {narrativeDocs.map((doc) => (
        <article
          key={doc.sourceFile}
          onClick={handleClick}
          className="docs-article cockpit-prose"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      ))}
    </section>
  );
}
