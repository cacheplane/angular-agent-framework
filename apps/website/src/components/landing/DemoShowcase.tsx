'use client';
import { useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { ClipPlayer } from '../ui/ClipPlayer';
import { TabGroup } from '../ui/TabGroup';
import { Button } from '../ui/Button';
import { DemoCtaPair } from './DemoCtaPair';
import { DemoModal } from './DemoModal';
import { trackCtaClick } from '../../lib/analytics/client';
import { DEMOS } from '../../lib/demos';
import { AG_UI_CLIP, LANGGRAPH_CLIP, type DemoClip } from '../../lib/demo-media';

type TabKey = (typeof DEMOS)[number]['key'];

/** A runtime tab: the shared clip plus how this section labels and links it. */
interface DemoMedia extends DemoClip {
  key: TabKey;
  tabLabel: string;
  href: string;
}


const MEDIA: DemoMedia[] = [
  { ...LANGGRAPH_CLIP, key: 'langgraph', tabLabel: 'LangGraph', href: DEMOS.find((d) => d.key === 'langgraph')!.href },
  { ...AG_UI_CLIP, key: 'ag-ui', tabLabel: 'AG-UI', href: DEMOS.find((d) => d.key === 'ag-ui')!.href },
];

export function DemoShowcase() {
  const [active, setActive] = useState<TabKey>('langgraph');
  const [modalOpen, setModalOpen] = useState(false);
  const launch = (media: DemoMedia) => {
    setActive(media.key);
    trackCtaClick({ surface: 'home_demo', destination_url: media.href, cta_id: `home_demo_launch_${media.key.replace(/-/g, '_')}`, cta_text: 'Launch live demo' });
    setModalOpen(true);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontFamily: tokens.typography.fontMono, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.colors.accent, margin: 0 }}>See it running</p>
      <h2 style={{ fontFamily: tokens.typography.h2.family, fontSize: tokens.typography.h2.size, lineHeight: tokens.typography.h2.line, fontWeight: 700, color: tokens.colors.textPrimary, margin: '10px 0 8px', letterSpacing: '-0.015em' }}>
        One chat UI. Two runtimes. Same code.
      </h2>
      <p style={{ fontFamily: tokens.typography.bodyLg.family, fontSize: tokens.typography.bodyLg.size, lineHeight: tokens.typography.bodyLg.line, color: tokens.colors.textSecondary, maxWidth: 560, margin: '0 auto 20px' }}>
        The identical Threadplane chat surface, running live against a LangGraph backend and an AG-UI backend. Switch tabs to compare — the front end never changes.
      </p>

      {/*
        Runtime tabs, not medium tabs — this section's whole argument is that the
        SAME front end runs on two backends. `TabGroup` supplies the ARIA tabs
        pattern (roving tabindex, arrow/Home/End keys, focus following
        selection); previously this rendered tab roles with none of that
        behaviour, which promised assistive tech a widget that did not respond.
      */}
      <TabGroup
        groupId="home-demo"
        label="Demo backend"
        panes={MEDIA.map((m) => ({
          id: m.key,
          label: m.tabLabel,
          content: (
            <ClipPlayer
              clip={m}
              overlay={
                <button onClick={() => launch(m)} aria-label={`Launch ${m.tabLabel} live demo`}
                  style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                    background: 'linear-gradient(180deg, rgba(16,18,32,.15), rgba(16,18,32,.45))', border: 'none', cursor: 'pointer' }}>
                  <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15161f', fontSize: 22 }}>&#9654;</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#fff', background: 'rgba(0,0,0,.5)', padding: '8px 14px', borderRadius: 8 }}>Launch live demo</span>
                </button>
              }
            />
          ),
        }))}
        onSelect={(pane) => setActive(pane.id as TabKey)}
      />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        <DemoCtaPair surface="home_demo" size="lg" />
        <Button variant="ghost" size="lg" href="https://cockpit.threadplane.ai" target="_blank" rel="noopener noreferrer">
          See each feature in action →
        </Button>
      </div>
      <p style={{ fontFamily: tokens.typography.caption.family, fontSize: tokens.typography.caption.size, color: tokens.colors.textMuted, margin: '14px 0 0' }}>
        Video loops instantly · click Launch to open the live, interactive demo · no signup
      </p>
      <DemoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tabs={MEDIA}
        active={active}
        onActive={setActive}
      />
    </div>
  );
}
