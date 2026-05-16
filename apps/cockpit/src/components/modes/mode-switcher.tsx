'use client';

import React, { useRef, useEffect, useState } from 'react';
import { track } from '../../lib/analytics/client';
import type { CockpitShellProps } from '../../lib/analytics/events';

interface ModeSwitcherProps<T extends string> {
  modes: readonly T[];
  activeMode: T;
  onChange: (mode: T) => void;
  /** Optional capability slug — when provided, mode changes fire cockpit:mode_switched. */
  capability?: string;
}

const MODE_MAP: Record<string, CockpitShellProps['from_mode']> = {
  Run: 'run',
  Code: 'code',
  Docs: 'docs',
  API: 'api',
};

export function ModeSwitcher<T extends string>({
  modes,
  activeMode,
  onChange,
  capability,
}: ModeSwitcherProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeIndex = modes.indexOf(activeMode);
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-mode-btn]');
    const btn = buttons[activeIndex];
    if (btn) {
      setIndicatorStyle({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    }
  }, [activeMode, modes]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        padding: 3,
        borderRadius: 999,
        background: 'var(--ds-surface-tinted)',
        border: '1px solid var(--ds-border)',
      }}
    >
      {/* Sliding indicator */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: indicatorStyle.left ?? 0,
          width: indicatorStyle.width ?? 0,
          borderRadius: 999,
          background: 'var(--ds-accent)',
          transition: 'left 0.25s ease, width 0.25s ease',
          zIndex: 0,
        }}
      />

      {modes.map((mode) => {
        const isActive = mode === activeMode;
        return (
          <button
            key={mode}
            data-mode-btn
            type="button"
            onClick={() => {
              if (mode !== activeMode) {
                if (capability) {
                  track('cockpit:mode_switched', {
                    capability,
                    from_mode: MODE_MAP[activeMode as string],
                    to_mode: MODE_MAP[mode as string],
                  });
                }
              }
              onChange(mode);
            }}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '6px 14px',
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--ds-text-inverted)' : 'var(--ds-text-secondary)',
              fontFamily: 'var(--ds-font-mono)',
              fontSize: '0.8rem',
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              transition: 'color 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}
