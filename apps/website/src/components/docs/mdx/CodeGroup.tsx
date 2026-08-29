'use client';
import { useState, Children, isValidElement } from 'react';

export function CodeGroup({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const blocks = Children.toArray(children).filter(isValidElement);

  const titles = blocks.map((block, i) => {
    const pre = block as React.ReactElement<{ 'data-title'?: string }>;
    return pre.props['data-title'] ?? `File ${i + 1}`;
  });

  return (
    <div className="mdx-codegroup">
      {/* Tab bar — same treatment as Tabs */}
      <div className="mdx-codegroup-bar">
        {titles.map((title, i) => (
          <button
            key={title}
            onClick={() => setActive(i)}
            className="mdx-codegroup-tab"
            data-active={active === i ? '' : undefined}
          >
            {title}
          </button>
        ))}
      </div>
      {/* Active code block container — code body stays dark (tokyo-night) */}
      <div className="mdx-codegroup-panel">
        {blocks[active]}
      </div>
    </div>
  );
}
