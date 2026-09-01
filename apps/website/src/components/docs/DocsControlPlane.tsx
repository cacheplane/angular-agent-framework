'use client';

import {
  BookOpen,
  Braces,
  Cloud,
  Code2,
  ExternalLink,
  Gauge,
  MonitorCog,
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
import {
  buildCockpitHandoffProperties,
  buildCockpitModeHref,
  COCKPIT_ENVIRONMENT_LABEL,
  resolveCockpitIdentity,
} from '../../lib/cockpit-links';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';
import { DocsNavigation } from './DocsSidebar';

export interface DocsControlPlaneProps {
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
  pageTitle: string;
}

const dispatchSearch = () =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true })
  );

export function DocsContextContent({
  activeLibrary,
  activeSection,
  activeSlug,
  pageTitle,
  mobile = false,
  onNavigate,
  onSearchHandoff,
}: DocsControlPlaneProps & {
  mobile?: boolean;
  onNavigate?: () => void;
  onSearchHandoff?: () => void;
}) {
  const preferences = useControlPlanePreferences('docs');
  const library = getLibraryConfig(activeLibrary);
  const section = getDocsSection(activeLibrary, activeSection);
  const openSearch = () => {
    if (!mobile) {
      dispatchSearch();
      return;
    }
    if (onSearchHandoff) {
      onSearchHandoff();
      return;
    }
    onNavigate?.();
    window.requestAnimationFrame(dispatchSearch);
  };
  const identity = {
    library: activeLibrary,
    section: activeSection,
    slug: activeSlug,
  };
  const target = resolveCockpitIdentity(
    activeLibrary,
    activeSection,
    activeSlug
  );
  const runtimeHref = buildCockpitModeHref(identity, 'Run');
  const trackHandoff = (mode: 'Run' | 'Code' | 'API') =>
    track(
      analyticsEvents.docsCockpitHandoff,
      buildCockpitHandoffProperties(identity, mode)
    );
  const runtimeRows = [
    {
      label: 'Environment',
      value: COCKPIT_ENVIRONMENT_LABEL,
      icon: <Cloud size={15} aria-hidden="true" />,
    },
    {
      label: 'Destination',
      value: 'Cockpit',
      icon: <MonitorCog size={15} aria-hidden="true" />,
    },
    ...(target
      ? [
          {
            label: 'Capability',
            value: target.topic,
            icon: <Gauge size={15} aria-hidden="true" />,
          },
        ]
      : []),
    {
      label: 'Mode',
      value: 'Run',
      icon: <Play size={15} aria-hidden="true" />,
    },
  ];

  return (
    <div data-docs-control-plane-context data-mobile={mobile || undefined}>
      <ControlPlaneSection title="Scope" collapsible={false}>
        <div className="docs-control-plane-scope">
          <span>{library?.title ?? activeLibrary}</span>
          <span>{section?.title ?? activeSection}</span>
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

      <div data-docs-runtime-preview>
        <ControlPlaneSection
          title="Runtime"
          summary="Cockpit"
          open={preferences.expanded.Runtime ?? false}
          onOpenChange={(open) => preferences.setExpanded('Runtime', open)}
        >
          <ControlPlaneEnvironmentList rows={runtimeRows} />
          <ControlPlaneActionBar label="Runtime actions">
            <ControlPlaneIconButton
              label="Open controls in Cockpit"
              icon={<ExternalLink size={16} aria-hidden="true" />}
              href={runtimeHref}
              onClick={() => trackHandoff('Run')}
            />
          </ControlPlaneActionBar>
        </ControlPlaneSection>
      </div>

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
    library: props.activeLibrary,
    section: props.activeSection,
    slug: props.activeSlug,
  };
  const currentPath = `/docs/${props.activeLibrary}/${props.activeSection}/${props.activeSlug}`;
  const handoff = (mode: 'Run' | 'Code' | 'API') =>
    track(
      analyticsEvents.docsCockpitHandoff,
      buildCockpitHandoffProperties(identity, mode)
    );

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
              onSelect={() => handoff('Run')}
            />
            <ControlPlaneRailItem
              label="Code"
              icon={<Code2 size={18} aria-hidden="true" />}
              href={buildCockpitModeHref(identity, 'Code')}
              onSelect={() => handoff('Code')}
            />
            <ControlPlaneRailItem
              label="API"
              icon={<Braces size={18} aria-hidden="true" />}
              href={buildCockpitModeHref(identity, 'API')}
              onSelect={() => handoff('API')}
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
