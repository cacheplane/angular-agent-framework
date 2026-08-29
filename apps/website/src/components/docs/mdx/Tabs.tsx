'use client';
import { useState, Children, isValidElement } from 'react';

interface TabProps {
  label?: string;
  children: React.ReactNode;
}

export function Tabs({ items, children }: { items?: string[]; children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const tabs = Children.toArray(children);

  // Extract labels: from items prop, from Tab label prop, or fallback
  const labels = items ?? tabs.map((child, i) => {
    if (isValidElement<TabProps>(child) && child.props.label) {
      return child.props.label;
    }
    return `Tab ${i + 1}`;
  });

  return (
    <div className="mdx-tabs">
      {/* Tab bar */}
      <div className="mdx-tabs-bar">
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            className="mdx-tab-button"
            data-active={active === i ? '' : undefined}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Tab body — no wrapper border/background; the inner code block owns its surface */}
      <div>
        {tabs[active]}
      </div>
    </div>
  );
}

export function Tab({ children }: TabProps) {
  return <div>{children}</div>;
}
