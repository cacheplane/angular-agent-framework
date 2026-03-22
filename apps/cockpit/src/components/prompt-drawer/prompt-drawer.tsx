'use client';

import React, { useEffect, useState } from 'react';

interface PromptDrawerProps {
  isOpen: boolean;
  entryTitle: string;
  paths: readonly string[];
  onClose: () => void;
}

const getPromptLabel = (path: string): string => path.split('/').pop() ?? path;

export function PromptDrawer({
  isOpen,
  entryTitle,
  paths,
  onClose,
}: PromptDrawerProps) {
  const [activePath, setActivePath] = useState(paths[0] ?? '');

  useEffect(() => {
    if (!paths.includes(activePath)) {
      setActivePath(paths[0] ?? '');
    }
  }, [activePath, paths]);

  if (!isOpen) {
    return null;
  }

  const resolvedActivePath = paths.includes(activePath) ? activePath : (paths[0] ?? '');

  return (
    <aside aria-label="Prompt drawer" className="cockpit-prompt-drawer">
      <header className="cockpit-prompt-drawer__header">
        <div>
          <p className="cockpit-eyebrow">Prompt assets</p>
          <h2>{entryTitle}</h2>
          <p>Keep the runnable surface in view while you inspect or copy the prompt path.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>

      {paths.length === 0 ? (
        <p>No prompt assets are available for this example.</p>
      ) : (
        <>
          <div className="cockpit-prompt-drawer__tabs" role="tablist" aria-label="Prompt assets">
            {paths.map((path) => {
              const isActive = path === resolvedActivePath;

              return (
                <button
                  key={path}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActivePath(path)}
                >
                  {getPromptLabel(path)}
                </button>
              );
            })}
          </div>

          <section aria-label="Prompt asset content" className="cockpit-prompt-drawer__body">
            <p className="cockpit-code-path">{resolvedActivePath}</p>
            <pre>{`Prompt preview for ${getPromptLabel(resolvedActivePath)}`}</pre>
            <button type="button">Copy prompt path</button>
          </section>
        </>
      )}
    </aside>
  );
}
