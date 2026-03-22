import React from 'react';

interface RunModeProps {
  entryTitle: string;
  codeAssetPaths: readonly string[];
  docsPath: string;
}

export function RunMode({ entryTitle, codeAssetPaths, docsPath }: RunModeProps) {
  return (
    <section aria-label="Run mode" className="cockpit-run-mode">
      <div className="cockpit-run-mode__surface">
        <p className="cockpit-eyebrow">Run</p>
        <h2>Interactive example</h2>
        <p>Open the working surface first, then move into code or docs as you need detail.</p>
        <div className="cockpit-run-mode__viewport" aria-label="Live example surface">
          <p>{entryTitle}</p>
          <p>Live example surface ready.</p>
        </div>
      </div>

      <aside className="cockpit-run-mode__context" aria-label="Run mode context">
        <h3>Implementation context</h3>
        <p className="cockpit-code-path">{docsPath}</p>
        <ul>
          {codeAssetPaths.map((path) => (
            <li key={path}>{path}</li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
