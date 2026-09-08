import { Hero } from '../components/landing/Hero';
import { Reliability } from '../components/landing/Reliability';
import { EnterpriseArchitecture } from '../components/landing/EnterpriseArchitecture';
import { Stage } from '../components/landing/Stage';
import { TeamsBlock } from '../components/landing/TeamsBlock';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { OpenSourceStrip } from '../components/landing/OpenSourceStrip';
import { RecentArticles } from '../components/landing/RecentArticles';
// The homepage must stay statically rendered (no cookies()/headers()/dynamic):
// the proof lines are read from the demo recording at build time, and the file
// is traced into the deployment only as a safety net.
import { STAGE_PROOF } from '../lib/stage-proof';
import {
  createPageMetadata,
  HOME_DESCRIPTION,
  HOME_TITLE,
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
      <EnterpriseArchitecture />

      {/* The four capability beats (stream, persist, approve, render): stills
          by default, the pinned live act on wide, motion-tolerant viewports
          (live-stage spec §3, §8). Copy lives in STAGE_RAIL (positioning.ts). */}
      <Stage proof={STAGE_PROOF} />

      {/* The open-source beat: a slim dark strip, not a second CTA. Copy lives
          in OPEN_SOURCE_STRIP (positioning.ts). */}
      <OpenSourceStrip />
      <TeamsBlock formPolicy={formPolicy} />
      <HomeFAQ />
      <RecentArticles />
    </>
  );
}
