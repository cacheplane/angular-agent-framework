import React from 'react';

interface ModeSwitcherProps<T extends string> {
  modes: readonly T[];
  activeMode: T;
  onChange: (mode: T) => void;
}

export function ModeSwitcher<T extends string>({
  modes,
  activeMode,
  onChange,
}: ModeSwitcherProps<T>) {
  return (
    <div aria-label="Primary modes">
      {modes.map((mode) => {
        const isActive = mode === activeMode;

        return (
          <button
            key={mode}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(mode)}
          >
            {mode}
          </button>
        );
      })}
    </div>
  );
}
