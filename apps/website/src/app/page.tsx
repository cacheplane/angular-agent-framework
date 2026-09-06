import { Hero } from '../components/landing/Hero';
import { Reliability } from '../components/landing/Reliability';
import { ScopeTable } from '../components/landing/ScopeTable';
import { Stage } from '../components/landing/Stage';
import { TeamsBlock } from '../components/landing/TeamsBlock';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { PROVE_IT_ROWS } from '../lib/positioning';
// The homepage must stay statically rendered (no cookies()/headers()/dynamic):
// the proof lines are read from the demo recording at build time, and the file
// is traced into the deployment only as a safety net.
import { STAGE_PROOF } from '../lib/stage-proof';
import {
  createPageMetadata,
  HERO_SECONDARY_HREF,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INSTALL_OPTIONS,
} from '../lib/site-metadata';
import { getFormPolicy } from '../lib/growth/form-policy';

export const metadata = createPageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  pathname: '/',
  type: 'website',
});

export default function HomePage() {
  const formPolicy = getFormPolicy();

  return (
    <>
      <Hero />
      <Reliability />
      <ScopeTable />

      {/* The four capability beats (stream, persist, approve, render): stills
          by default, the pinned live act on wide, motion-tolerant viewports
          (live-stage spec §3, §8). Copy lives in STAGE_RAIL (positioning.ts). */}
      <Stage proof={STAGE_PROOF} />

      <FinalCTA
        variant="dark"
        rows={PROVE_IT_ROWS}
        headline="Prove the Angular UI before you connect the backend."
        subtext="Start with a fake agent, render a real Threadplane surface, then swap in LangGraph or AG-UI when the integration is ready."
        primary={{
          label: 'Start the quickstart',
          href: INSTALL_OPTIONS[0].quickstartHref,
          ctaId: 'hero_quickstart',
        }}
        secondary={{
          label: 'Run live examples',
          href: HERO_SECONDARY_HREF,
          ctaId: 'hero_live_demo',
        }}
        caption="MIT · no account, no cloud"
        captionLink={{ label: 'Talk to an engineer', href: '/contact' }}
        captionLinks={[
          {
            label: 'Setup prompt for coding agents',
            href: '/docs/chat/getting-started/coding-agents',
          },
        ]}
      />
      <TeamsBlock formPolicy={formPolicy} />
      <HomeFAQ />
      <RecentArticles />
    </>
  );
}
