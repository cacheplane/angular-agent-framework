export const COCKPIT_DOCS_MAPPING_KEYS = ['product', 'section', 'topic', 'page', 'language'] as const;

export type CockpitDocsMappingKey = (typeof COCKPIT_DOCS_MAPPING_KEYS)[number];

export interface CockpitDocsMapping {
  product: string;
  section: string;
  topic: string;
  page: string;
  language: string;
  docsPath: string;
}

export interface CockpitDocsAdapterContract {
  name: string;
  mappingKeys: readonly CockpitDocsMappingKey[];
  description: string;
}
