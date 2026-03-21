export const COCKPIT_SHELL_ENTRY_KINDS = {
  docsOnly: 'docs-only',
  capability: 'capability',
} as const;

export const COCKPIT_SHELL_RUNTIME_CLASSES = {
  docsOnly: 'docs-only',
  browser: 'browser',
  localService: 'local-service',
  secretGated: 'secret-gated',
  deployedService: 'deployed-service',
} as const;

export type CockpitShellEntryKind =
  (typeof COCKPIT_SHELL_ENTRY_KINDS)[keyof typeof COCKPIT_SHELL_ENTRY_KINDS];

export type CockpitShellRuntimeClass =
  (typeof COCKPIT_SHELL_RUNTIME_CLASSES)[keyof typeof COCKPIT_SHELL_RUNTIME_CLASSES];

export interface CockpitShellEntryIdentity {
  capabilityId: string;
  product: string;
  section: string;
  topic: string;
  page: string;
  language: string;
}

export interface CockpitShellEntryMetadata {
  title: string;
  summary: string;
  officialDocsId: string;
  docsPath: string;
}

export interface CockpitShellEntryBase
  extends CockpitShellEntryIdentity,
    CockpitShellEntryMetadata {
  entryKind: CockpitShellEntryKind;
}

export interface CockpitShellDocsOnlyEntry extends CockpitShellEntryBase {
  entryKind: typeof COCKPIT_SHELL_ENTRY_KINDS.docsOnly;
}

export interface CockpitShellCapabilityRuntimeMetadata {
  runtimeClass: Exclude<
    CockpitShellRuntimeClass,
    typeof COCKPIT_SHELL_RUNTIME_CLASSES.docsOnly
  >;
  mountPath: string;
  codeAssetPaths: readonly string[];
  promptAssetPaths: readonly string[];
}

export interface CockpitShellCapabilityEntry extends CockpitShellEntryBase {
  entryKind: typeof COCKPIT_SHELL_ENTRY_KINDS.capability;
  runtimeMetadata: CockpitShellCapabilityRuntimeMetadata;
  mount: () => void;
  smokeTest: () => void;
  integrationTest: () => void;
}

export type CockpitShellEntry =
  | CockpitShellDocsOnlyEntry
  | CockpitShellCapabilityEntry;

export const isCockpitShellCapabilityEntry = (
  entry: CockpitShellEntry
): entry is CockpitShellCapabilityEntry => entry.entryKind === 'capability';
