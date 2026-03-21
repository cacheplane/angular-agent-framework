import React from 'react';
import type { CockpitManifestEntry } from '../../../../libs/cockpit-registry/src/index';
import { resolveManifestLanguage } from '../../../../libs/cockpit-registry/src/index';
import { toCockpitPath } from '../lib/route-resolution';

const COCKPIT_LANGUAGES = ['python', 'typescript'] as const;

interface LanguageSwitcherProps {
  manifest: CockpitManifestEntry[];
  entry: CockpitManifestEntry;
}

export function LanguageSwitcher({ manifest, entry }: LanguageSwitcherProps) {
  return (
    <div aria-label="Language switcher">
      {COCKPIT_LANGUAGES.map((language) => {
        const resolvedEntry = resolveManifestLanguage({
          manifest,
          entry,
          language,
        });

        return (
          <a
            key={language}
            href={toCockpitPath(resolvedEntry)}
            aria-current={resolvedEntry.language === entry.language ? 'page' : undefined}
          >
            {language}
          </a>
        );
      })}
    </div>
  );
}
