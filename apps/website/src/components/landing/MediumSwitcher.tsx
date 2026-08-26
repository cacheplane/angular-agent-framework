// SPDX-License-Identifier: MIT
'use client';
import { useState, type ReactNode } from 'react';

export interface MediumPane {
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

export function MediumSwitcher({ sectionId, panes }: MediumSwitcherProps) {
  const [active, setActive] = useState(0);

  // One medium needs no control surface; chrome around a single option is noise.
  if (panes.length <= 1) {
    return <>{panes[0]?.content ?? null}</>;
  }

  return <>{panes[active].content}</>;
}
