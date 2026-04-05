import React from 'react';

interface RunModeProps {
  entryTitle: string;
  runtimeUrl: string | null;
}

export function RunMode({ entryTitle, runtimeUrl }: RunModeProps) {
  if (!runtimeUrl) {
    return (
      <section aria-label="Run mode" className="grid place-items-center h-full text-[var(--ds-text-muted)] text-sm">
        <p>No runtime available. Start the local dev server to preview.</p>
      </section>
    );
  }

  return (
    <section aria-label="Run mode" className="h-full">
      <iframe
        src={runtimeUrl}
        title={`${entryTitle} live example`}
        allow="clipboard-write"
        className="w-full h-full border-0 rounded"
      />
    </section>
  );
}
