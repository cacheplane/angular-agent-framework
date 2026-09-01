'use client';

import {
  Blocks,
  BookOpen,
  Braces,
  Code2,
  ExternalLink,
  Play,
  Search,
} from 'lucide-react';
import {
  ControlPlaneActionBar,
  ControlPlaneEnvironmentList,
  ControlPlaneIconButton,
  ControlPlanePane,
  ControlPlaneRail,
  ControlPlaneRailItem,
  ControlPlaneSection,
  useControlPlanePreferences,
} from '@threadplane/ui-react';
import {
  getDocsSection,
  getLibraryConfig,
  type LibraryId,
} from '../../lib/docs-config';
import { buildCockpitModeHref } from '../../lib/cockpit-links';
import { DocsNavigation } from './DocsSidebar';

export interface DocsControlPlaneProps {
  /** `null` on a library-neutral docs page, e.g. /docs/choosing-an-adapter. */
  activeLibrary: LibraryId | null;
  activeSection: string;
  activeSlug: string;
  pageTitle: string;
}

const dispatchSearch = () =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

export function DocsContextContent({
  activeLibrary,
  activeSection,
  activeSlug,
  pageTitle,
  mobile = false,
  onNavigate,
}: DocsControlPlaneProps & { mobile?: boolean; onNavigate?: () => void }) {
  const preferences = useControlPlanePreferences('docs');
  const library = activeLibrary ? getLibraryConfig(activeLibrary) : undefined;
  const section = activeLibrary ? getDocsSection(activeLibrary, activeSection) : undefined;
  const openSearch = () => {
    if (!mobile) {
      dispatchSearch();
      return;
    }
    onNavigate?.();
    window.setTimeout(dispatchSearch, 0);
  };
  const environmentRows = [
    { label: 'Framework', value: 'Angular', icon: <Blocks size={15} aria-hidden="true" /> },
    { label: 'Package manager', value: 'npm', icon: <Code2 size={15} aria-hidden="true" /> },
  ];

  return (
    <div data-docs-control-plane-context data-mobile={mobile || undefined}>
      <ControlPlaneSection title="Scope" collapsible={false}>
        <div className="docs-control-plane-scope">
          {/* A neutral page has no library and no section. Say only what is
           * true — inventing them is how the mobile drawer came to claim
           * "LangGraph / Getting Started" on the adapter-comparison page. */}
          <span>{library?.title ?? 'Docs'}</span>
          {library && section ? <span>{section.title}</span> : null}
          <strong>{pageTitle}</strong>
        </div>
      </ControlPlaneSection>

      <ControlPlaneSection
        title="Learn"
        open={preferences.expanded.Learn ?? true}
        onOpenChange={(open) => preferences.setExpanded('Learn', open)}
      >
        <DocsNavigation
          activeLibrary={activeLibrary}
          activeSection={activeSection}
          activeSlug={activeSlug}
          expanded={preferences.expanded}
          onExpandedChange={preferences.setExpanded}
          onNavigate={onNavigate}
        />
      </ControlPlaneSection>

      <ControlPlaneSection
        title="Environment"
        open={preferences.expanded.Environment ?? false}
        onOpenChange={(open) => preferences.setExpanded('Environment', open)}
      >
        <ControlPlaneEnvironmentList rows={environmentRows} />
      </ControlPlaneSection>

      <ControlPlaneSection title="Actions" collapsible={false}>
        <ControlPlaneActionBar label="Docs actions">
          <ControlPlaneIconButton
            label="Search docs"
            icon={<Search size={16} aria-hidden="true" />}
            onClick={openSearch}
          />
          {library?.demoUrl ? (
            <ControlPlaneIconButton
              label={library.demoLabel ?? 'Open live demo'}
              icon={<ExternalLink size={16} aria-hidden="true" />}
              href={library.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
            />
          ) : null}
        </ControlPlaneActionBar>
      </ControlPlaneSection>
    </div>
  );
}

export function DocsControlPlane(props: DocsControlPlaneProps) {
  const identity = {
    library: props.activeLibrary ?? '',
    section: props.activeSection,
    slug: props.activeSlug,
  };
  const currentPath = props.activeLibrary
    ? `/docs/${props.activeLibrary}/${props.activeSection}/${props.activeSlug}`
    : '/docs';

  return (
    <div className="docs-control-plane" data-docs-control-plane>
      <ControlPlaneRail
        label="Docs modes"
        primary={
          <>
            <ControlPlaneRailItem
              label="Docs"
              icon={<BookOpen size={18} aria-hidden="true" />}
              href={currentPath}
              active
            />
            <ControlPlaneRailItem
              label="Run"
              icon={<Play size={18} aria-hidden="true" />}
              href={buildCockpitModeHref(identity, 'Run')}
            />
            <ControlPlaneRailItem
              label="Code"
              icon={<Code2 size={18} aria-hidden="true" />}
              href={buildCockpitModeHref(identity, 'Code')}
            />
            <ControlPlaneRailItem
              label="API"
              icon={<Braces size={18} aria-hidden="true" />}
              href={buildCockpitModeHref(identity, 'API')}
            />
          </>
        }
      />
      <ControlPlanePane label="Docs context">
        <DocsContextContent {...props} />
      </ControlPlanePane>
    </div>
  );
}
