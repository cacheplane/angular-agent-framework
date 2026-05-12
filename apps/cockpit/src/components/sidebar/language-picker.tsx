'use client';

import React, { useState, useEffect, useRef } from 'react';
import type {
  CockpitLanguage,
  CockpitManifestEntry,
} from '@ngaf/cockpit-registry';
import { resolveManifestLanguage } from '@ngaf/cockpit-registry';
import { toCockpitPath } from '../../lib/route-resolution';

const LANGUAGE_OPTIONS: Array<{ language: CockpitLanguage; label: string }> = [
  { language: 'python', label: 'Python' },
  { language: 'typescript', label: 'TypeScript' },
];

interface LanguagePickerProps {
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
}

export function LanguagePicker({ manifest, entry }: LanguagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel =
    LANGUAGE_OPTIONS.find(({ language }) => language === entry.language)?.label ?? entry.language;

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        style={{
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid var(--ds-border)',
          background: 'var(--ds-surface)',
          color: 'var(--ds-text-secondary)',
          fontSize: '0.75rem',
          fontFamily: 'var(--ds-font-mono)',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        {currentLabel}
      </button>
      {isOpen ? (
        <div
          role="menu"
          aria-label="Language picker"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 120,
            padding: 4,
            borderRadius: 8,
            border: '1px solid var(--ds-border)',
            background: 'var(--ds-surface)',
            boxShadow: 'var(--ds-shadow-md)',
            zIndex: 50,
          }}
        >
          {LANGUAGE_OPTIONS.map(({ language, label }) => {
            const resolvedEntry = resolveManifestLanguage({ manifest, entry, language });
            const isActive = language === entry.language;

            return (
              <a
                key={language}
                role="menuitem"
                href={toCockpitPath(resolvedEntry)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'block',
                  padding: '6px 10px',
                  borderRadius: 4,
                  fontSize: '0.8rem',
                  color: isActive ? 'var(--ds-accent)' : 'var(--ds-text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
              >
                {label}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
