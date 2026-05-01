import { cockpitManifest, type CockpitProduct, type CockpitSection, type CockpitPageId, type CockpitLanguage } from '@ngaf/cockpit-registry';
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
    product: (slug[0] ?? DEFAULT_COCKPIT_SLUG[0]) as CockpitProduct,
    section: (slug[1] ?? DEFAULT_COCKPIT_SLUG[1]) as CockpitSection,
    topic: slug[2] ?? DEFAULT_COCKPIT_SLUG[2],
    page: (slug[3] ?? DEFAULT_COCKPIT_SLUG[3]) as CockpitPageId,
    language: (slug[4] ?? DEFAULT_COCKPIT_SLUG[4]) as CockpitLanguage,
  });

  return {
    entry: resolvedEntry,
    presentation: getCapabilityPresentation(resolvedEntry),
    navigationTree: buildNavigationTree(cockpitManifest),
    canonicalPath: toCockpitPath(resolvedEntry),
  };
}
