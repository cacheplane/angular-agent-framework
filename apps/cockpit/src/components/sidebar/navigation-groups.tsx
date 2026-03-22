import React from 'react';
import type { CockpitManifestEntry } from '../../../../../libs/cockpit-registry/src/index';
import type { NavigationProduct } from '../../lib/route-resolution';
import { toCockpitPath } from '../../lib/route-resolution';

const PRODUCT_LABELS: Record<NavigationProduct['product'], string> = {
  'deep-agents': 'Deep Agents',
  langgraph: 'LangGraph',
};

const SECTION_LABELS: Record<NavigationProduct['sections'][number]['section'], string> = {
  'getting-started': 'Getting started',
  'core-capabilities': 'Core capabilities',
};

interface NavigationGroupsProps {
  tree: NavigationProduct[];
  currentEntry: CockpitManifestEntry;
}

export function NavigationGroups({ tree, currentEntry }: NavigationGroupsProps) {
  return (
    <nav aria-label="Cockpit navigation">
      {tree.map((product) => (
        <section key={product.product} aria-label={PRODUCT_LABELS[product.product]}>
          <h2>{PRODUCT_LABELS[product.product]}</h2>
          {product.sections.map((section) => (
            <div key={section.section}>
              <h3>{SECTION_LABELS[section.section]}</h3>
              <ul>
                {section.entries.map((entry) => {
                  const isCurrent =
                    entry.product === currentEntry.product &&
                    entry.section === currentEntry.section &&
                    entry.topic === currentEntry.topic &&
                    entry.page === currentEntry.page &&
                    entry.language === currentEntry.language;

                  return (
                    <li key={`${entry.product}/${entry.section}/${entry.topic}`}>
                      <a href={toCockpitPath(entry)} aria-current={isCurrent ? 'page' : undefined}>
                        {entry.title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </nav>
  );
}
