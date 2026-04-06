import { PilotHero } from '../../components/landing/PilotHero';
import { tokens } from '../../../lib/design-tokens';

export default function PilotToProdPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <PilotHero />
      {/* More sections to follow */}
    </div>
  );
}
