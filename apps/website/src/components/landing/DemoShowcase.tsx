'use client';
import { useState } from 'react';
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
    <div className="demo-showcase">
      <div className="demo-showcase__rail">
        <p className="demo-showcase__eyebrow">See it running</p>
        <span className="demo-showcase__rail-line" aria-hidden="true" />
      </div>
      <h2 className="demo-showcase__heading">
        One chat UI. Two runtimes. Same code.
      </h2>
      <p className="demo-showcase__subhead">
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
                  className="demo-showcase__launch-btn">
                  <span className="demo-showcase__launch-icon">&#9654;</span>
                  <span className="demo-showcase__launch-label">Launch live demo</span>
                </button>
              }
            />
          ),
        }))}
        onSelect={(pane) => setActive(pane.id as TabKey)}
      />

      <div className="demo-showcase__cta-row">
        <DemoCtaPair surface="home_demo" size="lg" />
        <Button variant="ghost" size="lg" href="/docs/langgraph/guides/streaming?mode=run">
          See each feature in action →
        </Button>
      </div>
      <p className="demo-showcase__caption">
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
