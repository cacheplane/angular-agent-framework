import React from 'react';
interface CodePaneProps {
  paths: string[];
}

export function CodePane({ paths }: CodePaneProps) {
  return (
    <section>
      <h2>Code</h2>
      <ul>
        {paths.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
    </section>
  );
}
