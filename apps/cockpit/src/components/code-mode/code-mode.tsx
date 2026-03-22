import React, { useEffect, useState } from 'react';

interface CodeModeProps {
  entryTitle: string;
  codeAssetPaths: readonly string[];
}

const getTabLabel = (path: string): string => path.split('/').pop() ?? path;

export function CodeMode({ entryTitle, codeAssetPaths }: CodeModeProps) {
  const [activePath, setActivePath] = useState(codeAssetPaths[0] ?? '');

  useEffect(() => {
    if (!codeAssetPaths.includes(activePath)) {
      setActivePath(codeAssetPaths[0] ?? '');
    }
  }, [activePath, codeAssetPaths]);

  if (codeAssetPaths.length === 0) {
    return (
      <section aria-label="Code mode" className="cockpit-code-mode">
        <h2>Code</h2>
        <p>No code files are available for {entryTitle}.</p>
      </section>
    );
  }

  const activeIndex = codeAssetPaths.indexOf(activePath);
  const resolvedActivePath = activeIndex >= 0 ? activePath : codeAssetPaths[0];

  return (
    <section aria-label="Code mode" className="cockpit-code-mode">
      <header aria-label="Editor header" className="cockpit-code-mode__header">
        <h2>Code</h2>
        <p>{entryTitle}</p>
        <p className="cockpit-code-path">{resolvedActivePath}</p>
      </header>

      <div
        role="tablist"
        aria-label="Code files"
        className="cockpit-code-mode__tabs"
      >
        {codeAssetPaths.map((path) => {
          const isActive = path === resolvedActivePath;

          return (
            <button
              key={path}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivePath(path)}
            >
              {getTabLabel(path)}
            </button>
          );
        })}
      </div>

      <article aria-label="Active file editor" className="cockpit-code-mode__editor">
        <p>Viewing {resolvedActivePath}</p>
        <pre>{`Source preview for ${getTabLabel(resolvedActivePath)}`}</pre>
      </article>
    </section>
  );
}
