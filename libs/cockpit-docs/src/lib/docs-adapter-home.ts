import type { CockpitDocsAdapterContract } from './docs-mapping-contracts';
import { COCKPIT_DOCS_MAPPING_KEYS } from './docs-mapping-contracts';

export const COCKPIT_DOCS_ADAPTER_HOME: CockpitDocsAdapterContract = {
  name: 'cockpit-docs-content-adapter',
  mappingKeys: COCKPIT_DOCS_MAPPING_KEYS,
  description: 'Shared docs mapping contract for cockpit content adapters.',
};
