import React from 'react';
import { toCockpitHref, type DocsBundle } from '../../../../../libs/cockpit-docs/src/index';

interface OpenInCockpitProps {
  bundle: DocsBundle;
}

export function OpenInCockpit({ bundle }: OpenInCockpitProps) {
  return <a href={toCockpitHref(bundle)}>Open in cockpit</a>;
}
