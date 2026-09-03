'use client';
import { type ReactNode } from 'react';
import { TabGroup, type TabPane } from '../ui/TabGroup';
import { trackCtaClick } from '../../lib/analytics/client';

export interface MediumPane {
  /** Unique within a switcher — used for React keys and DOM ids. */
  id: string;
  /** Which medium this is; drives analytics, not identity. */
  key: 'video' | 'code' | 'live';
  label: string;
  /**
   * Pre-rendered content. Code panes are highlighted on the server and passed
   * in, because `HighlightedCode` is an async Server Component and a client
   * component cannot render one as a child.
   */
  content: ReactNode;
}

interface MediumSwitcherProps {
  /** Used for tab/panel ids and the analytics `cta_id`. */
  sectionId: string;
  panes: MediumPane[];
}

/**
 * A homepage section's medium picker: the same claim as a video, as code, or as
 * a live embed.
 *
 * The tabs pattern itself lives in `TabGroup` — this adds only the medium
 * semantics and the analytics, so `DemoShowcase` can share the mechanics
 * without inheriting a `cta_id` shape that means nothing for runtime tabs.
 */
export function MediumSwitcher({ sectionId, panes }: MediumSwitcherProps) {
  const byMedium = new Map(panes.map((pane) => [pane.id, pane.key]));

  return (
    <TabGroup
      groupId={sectionId}
      label={`Choose how to view the ${sectionId} section`}
      panes={panes satisfies TabPane[]}
      onSelect={(pane) =>
        trackCtaClick({
          surface: 'home_medium_switcher',
          cta_id: `medium_${sectionId}_${byMedium.get(pane.id)}`,
          cta_text: pane.label,
        })
      }
    />
  );
}
