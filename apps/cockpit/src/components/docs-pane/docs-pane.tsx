import React from 'react';
import { DocsMode } from '../docs-mode/docs-mode';

interface DocsPaneProps {
  path: string;
}

export function DocsPane({ path }: DocsPaneProps) {
  return (
    <DocsMode
      entryTitle="Implementation guide"
      docsPath={path}
      summary="Move between the live surface, relevant code files, and the prompt assets without leaving the workspace."
      sections={[
        {
          title: 'Start from the live surface',
          body: 'Run the example first, then use Code to inspect the implementation paths that support the behavior you just saw.',
          code: 'npx nx serve cockpit',
        },
      ]}
      promptCopy="Open prompt assets"
    />
  );
}
