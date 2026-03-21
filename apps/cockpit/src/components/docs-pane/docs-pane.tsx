import React from 'react';
interface DocsPaneProps {
  path: string;
}

export function DocsPane({ path }: DocsPaneProps) {
  return (
    <section>
      <h2>Docs</h2>
      <p>{path}</p>
    </section>
  );
}
