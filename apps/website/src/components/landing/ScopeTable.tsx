import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { FINAL_MILE_ASIDE, FINAL_MILE_HEADING } from '../../lib/positioning';

const ROWS = [
  {
    start: 'Raw SSE or stream SDK',
    gives: 'Transport and events',
    adds: 'Angular state model, chat UX, threads, approvals, generated UI, recovery, tests',
  },
  {
    start: 'Backend agent framework',
    gives: 'Agent runtime and orchestration',
    adds: 'The production Angular application and interaction layer',
  },
  {
    start: 'Generative-UI renderer',
    gives: 'Structured UI rendering',
    adds: 'Full agent UI, adapters, thread UX, interrupts, testing, and render support',
  },
  {
    start: 'React-first agent UI',
    gives: 'Mature React patterns',
    adds: 'Native Angular Signals, DI, templates, components, and testing',
  },
];

export function ScopeTable() {
  return (
    <Section surface="white" id="why" ariaLabelledBy="why-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="The final mile"
          heading={FINAL_MILE_HEADING}
          headingId="why-heading"
          aside={FINAL_MILE_ASIDE}
        />
        <div className="scope-table-wrap">
          <table className="scope-table">
            <thead>
              <tr>
                <th scope="col">Starting point</th>
                <th scope="col">What it gives you</th>
                <th scope="col">What Threadplane adds</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.start}>
                  <th scope="row">{row.start}</th>
                  <td>{row.gives}</td>
                  <td>{row.adds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </Section>
  );
}
