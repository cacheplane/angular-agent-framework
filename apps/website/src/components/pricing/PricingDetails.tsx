import { TIERS, type TierSlug } from '../../../../../pricing/tiers.config';

type ComparisonCells = Record<TierSlug, string>;

interface ComparisonRow {
  readonly label: string;
  readonly cells: ComparisonCells;
  readonly note?: string;
}

interface ComparisonGroup {
  readonly title: string;
  readonly rows: readonly ComparisonRow[];
}

const PAID_CAPABILITY: ComparisonCells = {
  community: 'For permitted free use',
  developer_seat: 'Included under commercial license',
  team: 'Included under commercial license',
  enterprise: 'Included under commercial license',
};

const COMPARISON_GROUPS: readonly ComparisonGroup[] = [
  {
    title: 'License and deployment',
    rows: [
      {
        label: 'Permitted free use',
        cells: {
          community: 'Yes, within PolyForm Noncommercial terms',
          developer_seat: 'Yes',
          team: 'Yes',
          enterprise: 'Yes',
        },
      },
      {
        label: '30-day commercial evaluation',
        cells: {
          community: '30 calendar days',
          developer_seat: 'Not needed after purchase',
          team: 'Not needed after purchase',
          enterprise: 'Handled during sales process',
        },
      },
      {
        label: 'Commercial production rights for @threadplane/chat',
        cells: {
          community: 'Not included',
          developer_seat: 'Included',
          team: 'Included',
          enterprise: 'Included by contract',
        },
      },
      {
        label: 'Developer coverage',
        cells: {
          community: 'Unlimited only for permitted free use',
          developer_seat: 'Per purchased seat',
          team: '5 developers included',
          enterprise: 'Custom or organization-wide by contract',
        },
      },
      {
        label: 'Licensed applications',
        cells: {
          community: 'Permitted free-use applications',
          developer_seat: 'Unlimited',
          team: 'Unlimited',
          enterprise: 'Multi-application or custom scope',
        },
      },
      {
        label: 'End-user seats required',
        cells: {
          community: 'No',
          developer_seat: 'No',
          team: 'No',
          enterprise: 'No',
        },
      },
      {
        label: 'Development, staging, CI/CD, and production use',
        cells: {
          community: 'Commercial evaluation only; no commercial production',
          developer_seat: 'Included',
          team: 'Included',
          enterprise: 'Included by contract',
        },
      },
      {
        label: 'Customer-deployed',
        cells: {
          community: 'Yes',
          developer_seat: 'Yes',
          team: 'Yes',
          enterprise: 'Yes',
        },
      },
      {
        label: 'Offline license verification',
        cells: {
          community: 'No paid token required for permitted free use',
          developer_seat: 'Signed token included',
          team: 'Signed token included',
          enterprise: 'Signed token included',
        },
      },
      {
        label: 'Recurring subscription',
        cells: {
          community: 'No',
          developer_seat: 'Monthly or annual',
          team: 'Monthly or annual',
          enterprise: 'Annual contract',
        },
      },
      {
        label: 'Custom contract',
        cells: {
          community: 'PolyForm terms',
          developer_seat: 'Standard commercial terms',
          team: 'Standard commercial terms',
          enterprise: 'Included',
        },
      },
    ],
  },
  {
    title: 'Framework and UI capabilities',
    rows: [
      'Headless chat primitives',
      'Composed chat UI',
      'Signal-based streaming state',
      'Tool-call progress and errors',
      'Human-in-the-loop interrupts',
      'Subagents and delegation surfaces',
      'Planning and memory surfaces',
      'Thread, history, and branch UI primitives',
      'Citations and sources',
      'json-render integration',
      'A2UI integration',
      'LangGraph adapter',
      'AG-UI adapter',
      'Light, dark, and Material-related theme presets',
      'Angular 20 and 21 support',
    ].map((label) => ({
      label,
      cells: PAID_CAPABILITY,
      ...(label === 'Thread, history, and branch UI primitives'
        ? {
            note:
              'Availability and durability depend on capabilities provided by the connected agent runtime and persistence layer.',
          }
        : {}),
    })),
  },
  {
    title: 'Support and procurement',
    rows: [
      {
        label: 'Documentation and examples',
        cells: { community: 'Included', developer_seat: 'Included', team: 'Included', enterprise: 'Included' },
      },
      {
        label: 'GitHub support',
        cells: { community: 'GitHub community support', developer_seat: 'Included', team: 'Included', enterprise: 'Included' },
      },
      {
        label: 'Email support',
        cells: { community: 'Not included', developer_seat: 'Not included', team: 'Included', enterprise: 'Included' },
      },
      {
        label: 'Private support channel or Slack Connect',
        cells: { community: 'Not included', developer_seat: 'Not included', team: 'Not included', enterprise: 'Included' },
      },
      {
        label: 'Response SLA',
        cells: { community: 'Not included', developer_seat: 'Not included', team: 'Not included', enterprise: 'Included' },
      },
      {
        label: 'Security review assistance',
        cells: { community: 'Not included', developer_seat: 'Not included', team: 'Not included', enterprise: 'Included' },
      },
      {
        label: 'Procurement support',
        cells: { community: 'Not applicable', developer_seat: 'Self-service checkout', team: 'Single team subscription', enterprise: 'Included' },
      },
      {
        label: 'Custom terms',
        cells: { community: 'Not included', developer_seat: 'Not included', team: 'Not included', enterprise: 'Available by contract' },
      },
      {
        label: 'Pilot-to-Prod availability',
        cells: { community: 'Contact sales', developer_seat: 'Contact sales', team: 'Contact sales', enterprise: 'Available as an optional engagement' },
      },
    ],
  },
];

export function ArchitectureBoundary() {
  return (
    <div className="pricing-boundary">
      <div className="pricing-section-heading-wrap">
        <p className="pricing-section-kicker">What you are buying</p>
        <h2 id="pricing-value-heading" className="pricing-section-heading">Same software. Different license scope and support.</h2>
        <p className="pricing-section-body">
          Threadplane does not gate core Angular agent UI capabilities by plan. Paid plans license{' '}
          <code>@threadplane/chat</code> for commercial production and expand developer coverage,
          support, and contract terms.
        </p>
      </div>

      <div className="pricing-boundary-flow" aria-label="Threadplane deployment architecture">
        <div className="pricing-boundary-block">
          <span className="pricing-boundary-label">Your product</span>
          <strong>Your Angular application</strong>
        </div>
        <span className="pricing-boundary-arrow" aria-hidden="true">→</span>
        <div className="pricing-boundary-block" data-accent>
          <span className="pricing-boundary-label">Runs in your app</span>
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
        <h2 id="pricing-comparison-heading" className="pricing-section-heading">What changes between plans.</h2>
        <p className="pricing-section-body">
          Capabilities stay consistent. License scope, developer coverage, support, and procurement terms change.
        </p>
      </div>
      <div className="pricing-comparison-scroll">
        <table className="pricing-comparison-table" aria-label="Full plan comparison">
          <thead>
            <tr>
              <th scope="col" className="pricing-comparison-feature-col">Plan detail</th>
              {TIERS.map((tier) => (
                <th
                  key={tier.slug}
                  scope="col"
                  className="pricing-comparison-plan-col"
                  data-highlight={tier.highlight || undefined}
                >
                  {tier.displayName}
                  {tier.highlight ? <span aria-hidden="true" className="pricing-comparison-popular">Most popular</span> : null}
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
                  <th scope="row" className="pricing-comparison-row-heading">
                    {row.label}
                    {row.note ? <span className="pricing-comparison-row-note">{row.note}</span> : null}
                  </th>
                  {TIERS.map((tier) => (
                    <td key={tier.slug} data-highlight={tier.highlight || undefined}>
                      {row.cells[tier.slug]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
