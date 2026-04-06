import { PilotHero } from '../../components/landing/PilotHero';
import { tokens } from '../../../lib/design-tokens';

export const metadata = {
  title: 'Pilot to Production — StreamResource',
  description: 'Close the last-mile gap. A structured 3-month Angular agent pilot at fixed price — ship to production or your money back.',
};

export default function PilotToProdPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <PilotHero />
      {/* More sections to follow */}
    </div>
  );
}
