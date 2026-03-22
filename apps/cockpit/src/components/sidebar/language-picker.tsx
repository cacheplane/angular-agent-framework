'use client';

import React, { useState } from 'react';
import type {
  CockpitLanguage,
  CockpitManifestEntry,
} from '../../../../../libs/cockpit-registry/src/index';
import { resolveManifestLanguage } from '../../../../../libs/cockpit-registry/src/index';
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
  const currentLabel =
    LANGUAGE_OPTIONS.find(({ language }) => language === entry.language)?.label ?? entry.language;

  return (
    <div>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
      >
        {currentLabel}
      </button>
      {isOpen ? (
        <div role="menu" aria-label="Language picker">
          {LANGUAGE_OPTIONS.map(({ language, label }) => {
            const resolvedEntry = resolveManifestLanguage({
              manifest,
              entry,
              language,
            });

            return (
              <a
                key={language}
                role="menuitem"
                href={toCockpitPath(resolvedEntry)}
                aria-current={language === entry.language ? 'true' : undefined}
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
