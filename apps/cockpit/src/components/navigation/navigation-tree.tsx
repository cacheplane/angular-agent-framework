import React from 'react';
import type { NavigationProduct } from '../../lib/route-resolution';
import { toCockpitPath } from '../../lib/route-resolution';

interface NavigationTreeProps {
  tree: NavigationProduct[];
}

export function NavigationTree({ tree }: NavigationTreeProps) {
  return (
    <nav aria-label="Cockpit navigation">
      {tree.map((product) => (
        <section key={product.product}>
          <h2>{product.product}</h2>
          {product.sections.map((section) => (
            <div key={section.section}>
              <h3>{section.section}</h3>
              <ul>
                {section.entries.map((entry) => (
                  <li key={`${entry.product}/${entry.section}/${entry.topic}`}>
                    <a href={toCockpitPath(entry)}>{entry.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </nav>
  );
}
