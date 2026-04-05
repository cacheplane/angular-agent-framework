import { cockpitManifest } from '@cacheplane/cockpit-registry';
import {
  buildNavigationTree,
  getCapabilityPresentation,
  resolveCockpitEntry,
  toCockpitPath,
  type NavigationProduct,
} from './route-resolution';

export { cockpitManifest };

export interface CockpitPageModel {
  entry: ReturnType<typeof resolveCockpitEntry>;
  presentation: ReturnType<typeof getCapabilityPresentation>;
  navigationTree: NavigationProduct[];
  canonicalPath: string;
}

const DEFAULT_COCKPIT_SLUG = [
  'langgraph',
  'core-capabilities',
  'streaming',
  'overview',
  'python',
] as const;

export function getCockpitPageModel(slug: string[] = []): CockpitPageModel {
  const resolvedEntry = resolveCockpitEntry({
    manifest: cockpitManifest,
    product: (slug[0] ?? DEFAULT_COCKPIT_SLUG[0]) as 'deep-agents' | 'langgraph',
    section: (slug[1] ?? DEFAULT_COCKPIT_SLUG[1]) as 'getting-started' | 'core-capabilities',
    topic: slug[2] ?? DEFAULT_COCKPIT_SLUG[2],
    page: (slug[3] ?? DEFAULT_COCKPIT_SLUG[3]) as 'overview' | 'build' | 'prompts' | 'code' | 'testing',
    language: (slug[4] ?? DEFAULT_COCKPIT_SLUG[4]) as 'python' | 'typescript',
  });

  return {
    entry: resolvedEntry,
    presentation: getCapabilityPresentation(resolvedEntry),
    navigationTree: buildNavigationTree(cockpitManifest),
    canonicalPath: toCockpitPath(resolvedEntry),
  };
}
