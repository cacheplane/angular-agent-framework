export type CockpitProduct = 'deep-agents' | 'langgraph' | 'render' | 'chat';

export type CockpitSection = 'getting-started' | 'core-capabilities';

export type CockpitPageId = 'overview' | 'build' | 'prompts' | 'code' | 'testing';

export type CockpitLanguage = 'python' | 'typescript';

export type CockpitEntryKind = 'docs-only' | 'capability';

export type CockpitRuntimeClass =
  | 'docs-only'
  | 'browser'
  | 'local-service'
  | 'secret-gated'
  | 'deployed-service';

export type CockpitLifecycleStatus =
  | 'planned'
  | 'implemented'
  | 'docs-authored'
  | 'cockpit-integrated'
  | 'smoke-tested'
  | 'integration-tested'
  | 'deployed';

export type CockpitIntegrationMode = 'none' | 'local' | 'secret-gated';

export interface CockpitTestingContract {
  smokeTarget: string | null;
  integrationTarget: string | null;
  integrationMode: CockpitIntegrationMode;
  deploySmokePath: string;
}

export interface CockpitManifestIdentity {
  product: CockpitProduct;
  section: CockpitSection;
  topic: string;
  page: CockpitPageId;
  language: CockpitLanguage;
}

export interface CockpitManifestEntry extends CockpitManifestIdentity {
  capabilityId: string;
  title: string;
  summary: string;
  officialDocsId: string;
  canonicalLanguage: CockpitLanguage;
  supportedLanguages: CockpitLanguage[];
  equivalentPages: Partial<Record<CockpitLanguage, CockpitManifestIdentity>>;
  fallbackTarget: CockpitManifestIdentity;
  entryKind: CockpitEntryKind;
  runtimeClass: CockpitRuntimeClass;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  implementationStatus: CockpitLifecycleStatus;
  docsStatus: CockpitLifecycleStatus;
  testStatus: CockpitLifecycleStatus;
  deploymentStatus: CockpitLifecycleStatus;
  testingContract: CockpitTestingContract;
}
