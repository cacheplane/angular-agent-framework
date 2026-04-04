import { PricingGrid } from '../../components/pricing/PricingGrid';
import { CompareTable } from '../../components/pricing/CompareTable';
import { LeadForm } from '../../components/pricing/LeadForm';

export default function PricingPage() {
  return (
    <div className="pt-24" style={{ background: 'var(--gradient-bg-flow)', minHeight: '100vh' }}>
      <div className="text-center px-8 py-16">
        <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--color-accent)' }}>Pricing</p>
        <h1
          style={{
            fontFamily: 'var(--font-garamond)',
            fontWeight: 800,
            fontSize: 'clamp(40px, 6vw, 80px)',
            color: 'var(--color-text-primary)',
          }}>
          Simple, transparent pricing
        </h1>
      </div>
      <PricingGrid />
      <CompareTable />
      <LeadForm />
    </div>
  );
}
