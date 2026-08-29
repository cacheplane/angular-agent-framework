import React from 'react';

export function Steps({ children }: { children: React.ReactNode }) {
  const steps = React.Children.toArray(children);
  return (
    <div className="mdx-steps-list">
      {steps.map((child, i) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child as React.ReactElement<{ stepNumber: number }>, { stepNumber: i + 1 });
      })}
    </div>
  );
}

export function Step({ title, children, stepNumber }: { title: string; children: React.ReactNode; stepNumber?: number }) {
  return (
    <div className="mdx-step">
      <div className="mdx-step-rail">
        {/* Number circle */}
        <div className="mdx-step-number">{stepNumber ?? 1}</div>
        {/* Vertical connector */}
        <div className="mdx-step-connector" />
      </div>
      <div className="mdx-step-content">
        {/* Step title */}
        <div className="mdx-step-title">{title}</div>
        {/* Step body */}
        <div className="mdx-step-body">{children}</div>
      </div>
    </div>
  );
}
