import React from 'react';
import { tokens } from '@cacheplane/design-tokens';

export function Steps({ children }: { children: React.ReactNode }) {
  const steps = React.Children.toArray(children);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      {steps.map((child, i) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child as React.ReactElement<{ stepNumber: number }>, { stepNumber: i + 1 });
      })}
    </div>
  );
}

export function Step({ title, children, stepNumber }: { title: string; children: React.ReactNode; stepNumber?: number }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: tokens.colors.accent, color: '#fff',
          fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>{stepNumber ?? 1}</div>
        <div style={{ width: 1, flex: 1, background: `${tokens.colors.accent}33`, marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 8 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.9rem',
          color: tokens.colors.textPrimary,
          marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
