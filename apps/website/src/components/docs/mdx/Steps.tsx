import React from 'react';
import { tokens } from '@ngaf/design-tokens';

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
        {/* Number circle */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: tokens.radius.full,
          background: tokens.colors.accent,
          color: tokens.colors.textInverted,
          fontFamily: tokens.typography.fontMono,
          fontSize: 14,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>{stepNumber ?? 1}</div>
        {/* Vertical connector */}
        <div style={{ width: 2, flex: 1, background: tokens.surfaces.border, marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 8 }}>
        {/* Step title */}
        <div style={{
          fontFamily: tokens.typography.fontSans,
          fontSize: 17,
          fontWeight: 600,
          color: tokens.colors.textPrimary,
          marginBottom: 4,
        }}>{title}</div>
        {/* Step body */}
        <div style={{
          fontFamily: tokens.typography.body.family,
          fontSize: 16,
          lineHeight: 1.6,
          color: tokens.colors.textSecondary,
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
