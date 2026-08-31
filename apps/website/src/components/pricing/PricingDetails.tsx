import { TIERS, type TierSlug } from '../../../../../pricing/tiers.config';

type ComparisonCells = Record<TierSlug, string>;

interface ComparisonRow {
  readonly label: string;
  readonly cells: ComparisonCells;
}

const ALL_INCLUDED: ComparisonCells = {
  community: 'Included',
  production_assurance: 'Included',
  enterprise: 'Included',
};

const COMPARISON_GROUPS: readonly { title: string; rows: readonly ComparisonRow[] }[] = [
  {
    title: 'Software',
    rows: [
      { label: 'MIT-licensed software', cells: ALL_INCLUDED },
      { label: 'Commercial use', cells: ALL_INCLUDED },
      { label: 'All framework and UI capabilities', cells: ALL_INCLUDED },
      { label: 'Source modification and redistribution', cells: ALL_INCLUDED },
      { label: 'Customer-operated deployment', cells: ALL_INCLUDED },
    ],
  },
  {
    title: 'Support and delivery',
    rows: [
      { label: 'Public documentation and examples', cells: ALL_INCLUDED },
      {
        label: 'Private support channel',
        cells: { community: 'Not included', production_assurance: 'Included', enterprise: 'Included' },
      },
      {
        label: 'Response commitments',
        cells: { community: 'Not included', production_assurance: 'Defined scope', enterprise: 'Custom' },
      },
      {
        label: 'Architecture and implementation reviews',
        cells: { community: 'Not included', production_assurance: 'Included', enterprise: 'Included' },
      },
      {
        label: 'Security and procurement assistance',
        cells: { community: 'Not included', production_assurance: 'Included', enterprise: 'Included' },
      },
      {
        label: 'Pilot-to-Prod delivery',
        cells: { community: 'Not included', production_assurance: 'Optional', enterprise: 'Available' },
      },
      {
        label: 'Custom enablement and training',
        cells: { community: 'Not included', production_assurance: 'Optional', enterprise: 'Available' },
      },
    ],
  },
];

export function ArchitectureBoundary() {
  return (
    <div className="pricing-boundary">
      <div className="pricing-section-heading-wrap">
        <p className="pricing-section-kicker">What you are buying</p>
        <h2 id="pricing-value-heading" className="pricing-section-heading">Open software. Commercial support when you want it.</h2>
        <p className="pricing-section-body">
          Every Threadplane package and capability is available under MIT. Paid engagements add
          expertise, response commitments, and delivery support—not a different build or permission
          to use the software.
        </p>
      </div>
      <div className="pricing-boundary-flow" aria-label="Threadplane deployment architecture">
        <div className="pricing-boundary-block">
          <span className="pricing-boundary-label">Your product</span>
          <strong>Your Angular application</strong>
        </div>
        <span className="pricing-boundary-arrow" aria-hidden="true">→</span>
        <div className="pricing-boundary-block" data-accent>
          <span className="pricing-boundary-label">MIT software</span>
          <strong>Threadplane UI packages</strong>
        </div>
        <span className="pricing-boundary-arrow" aria-hidden="true">→</span>
        <div className="pricing-boundary-block">
          <span className="pricing-boundary-label">Customer-operated</span>
          <strong>Your agent runtime, models, storage, and infrastructure</strong>
        </div>
      </div>
      <p className="pricing-boundary-note">
        Threadplane does not host your agents or conversations. Runtime behavior, durable persistence,
        retention, and infrastructure costs are determined by the connected backend and providers.
      </p>
    </div>
  );
}

export function PricingComparison() {
  return (
    <div className="pricing-comparison">
      <div className="pricing-section-heading-wrap">
        <p className="pricing-section-kicker">Full comparison</p>
        <h2 id="pricing-comparison-heading" className="pricing-section-heading">What changes between paths.</h2>
        <p className="pricing-section-body">The software stays open. The level of support and delivery changes.</p>
      </div>
      <div className="pricing-comparison-scroll">
        <table className="pricing-comparison-table" aria-label="Full plan comparison">
          <thead>
            <tr>
              <th scope="col" className="pricing-comparison-feature-col">Plan detail</th>
              {TIERS.map((tier) => (
                <th key={tier.slug} scope="col" className="pricing-comparison-plan-col" data-highlight={tier.highlight || undefined}>
                  {tier.displayName}
                </th>
              ))}
            </tr>
          </thead>
          {COMPARISON_GROUPS.map((group) => (
            <tbody key={group.title}>
              <tr className="pricing-comparison-group-row">
                <th scope="rowgroup" colSpan={TIERS.length + 1}>{group.title}</th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="pricing-comparison-row-heading">{row.label}</th>
                  {TIERS.map((tier) => <td key={tier.slug} data-highlight={tier.highlight || undefined}>{row.cells[tier.slug]}</td>)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
