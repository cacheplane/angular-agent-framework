'use client';

import React, { useCallback } from 'react';

interface NarrativeDoc {
  title: string;
  html: string;
  sourceFile: string;
}

interface NarrativeDocsProps {
  narrativeDocs: NarrativeDoc[];
}

export function NarrativeDocs({ narrativeDocs }: NarrativeDocsProps) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;

    const copyCodeBtn = target.closest('[data-copy-code]') as HTMLElement | null;
    if (copyCodeBtn) {
      const codeBlock = copyCodeBtn.closest('.doc-codeblock');
      const code = codeBlock?.querySelector('pre code')?.textContent ?? '';
      navigator.clipboard.writeText(code);
      copyCodeBtn.textContent = 'Copied!';
      setTimeout(() => { copyCodeBtn.textContent = 'Copy'; }, 1500);
      return;
    }

    const copyPromptBtn = target.closest('[data-copy-prompt]') as HTMLElement | null;
    if (copyPromptBtn) {
      const promptBlock = copyPromptBtn.closest('.doc-prompt');
      const text = promptBlock?.querySelector('.doc-prompt__content')?.textContent ?? '';
      navigator.clipboard.writeText(text);
      copyPromptBtn.textContent = 'Copied!';
      setTimeout(() => { copyPromptBtn.textContent = 'Copy prompt'; }, 1500);
      return;
    }
  }, []);

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
          className="docs-article max-w-3xl text-[0.9rem] leading-relaxed text-[var(--ds-text-secondary)]
            [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-[var(--ds-text-primary)] [&_h1]:mb-2 [&_h1]:pb-3 [&_h1]:border-b [&_h1]:border-[var(--ds-accent-border)]
            [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-[var(--ds-text-primary)] [&_h2]:mt-10 [&_h2]:mb-3
            [&_h3]:font-semibold [&_h3]:text-[var(--ds-text-primary)] [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:mb-3 [&_p]:leading-relaxed
            [&_ul]:mb-3 [&_ul]:pl-5 [&_ul]:list-disc
            [&_li]:mb-1 [&_li]:leading-relaxed
            [&_a]:text-[var(--ds-accent)] [&_a]:no-underline hover:[&_a]:underline
            [&_code]:text-[var(--ds-accent)] [&_code]:bg-[var(--ds-accent-surface)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono
            [&_strong]:text-[var(--ds-text-primary)] [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      ))}
    </section>
  );
}
