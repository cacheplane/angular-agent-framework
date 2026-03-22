import React from 'react';

interface PromptPaneProps {
  paths: string[];
}

export function PromptPane({ paths }: PromptPaneProps) {
  return (
    <section aria-label="Prompt assets">
      <h2>Prompts</h2>
      <ul>
        {paths.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
    </section>
  );
}
