import React from 'react';
import { toCockpitHref, type DocsBundle } from '@cacheplane/cockpit-docs';

interface OpenInCockpitProps {
  bundle: DocsBundle;
}

export function OpenInCockpit({ bundle }: OpenInCockpitProps) {
  return <a href={toCockpitHref(bundle)}>Open in cockpit</a>;
}
