import { Container } from '../../../components/ui/Container';
import { Section } from '../../../components/ui/Section';
import { Eyebrow } from '../../../components/ui/Eyebrow';
import { Pill } from '../../../components/ui/Pill';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { BrowserFrame } from '../../../components/ui/BrowserFrame';
import { LogoMark } from '../../../components/ui/LogoMark';
import { FAQ, type FAQItem } from '../../../components/ui/FAQ';

export const metadata = { title: 'UI primitives — dev only' };

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'Is this real?',
    a: 'Yes — this page is for verifying the primitives during refactor Phase 1.',
  },
  {
    q: 'Will it stay forever?',
    a: 'No, this route gets deleted once the marketing pages have migrated.',
  },
];

export default function PrimitivesDevPage() {
  return (
    <>
      <Section surface="canvas">
        <Container>
          <h1
            data-testid="primitives-page-title"
            style={{ fontFamily: 'var(--font-garamond)', fontSize: 48, marginBottom: 24 }}
          >
            UI primitives
          </h1>

          <h2 style={{ marginTop: 32 }}>LogoMark</h2>
          <div style={{ display: 'flex', gap: 24, marginTop: 12, alignItems: 'center' }}>
            <LogoMark size="sm" />
            <LogoMark size="md" />
            <LogoMark size="md" iconOnly />
          </div>

          <h2 style={{ marginTop: 32 }}>Eyebrow</h2>
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <Eyebrow>Default muted</Eyebrow>
            <Eyebrow tone="accent">Accent</Eyebrow>
            <Eyebrow tone="angular">Angular</Eyebrow>
          </div>

          <h2 style={{ marginTop: 32 }}>Pill</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <Pill variant="neutral">MIT</Pill>
            <Pill variant="accent">LangGraph</Pill>
            <Pill variant="angular">Angular 20+</Pill>
          </div>

          <h2 style={{ marginTop: 32 }}>Button</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost →</Button>
            <Button variant="primary" size="lg" href="/docs">
              Large link
            </Button>
          </div>

          <h2 style={{ marginTop: 32 }}>Card</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            <Card>
              <Eyebrow>Standard</Eyebrow>
              <p style={{ marginTop: 8 }}>A basic card with default padding.</p>
            </Card>
            <Card hoverable>
              <Eyebrow>Hoverable</Eyebrow>
              <p style={{ marginTop: 8 }}>Hover me — gentle lift + stronger shadow.</p>
            </Card>
            <Card surface="tinted" padding="lg">
              <Eyebrow>Tinted, lg padding</Eyebrow>
              <p style={{ marginTop: 8 }}>Used for emphasized callouts.</p>
            </Card>
          </div>

          <h2 style={{ marginTop: 32 }}>BrowserFrame</h2>
          <div style={{ marginTop: 12, maxWidth: 600 }}>
            <BrowserFrame url="cockpit.threadplane.ai" elevation="md">
              <div
                style={{
                  padding: 60,
                  textAlign: 'center',
                  color: 'var(--color-text-muted)',
                }}
              >
                Placeholder content
              </div>
            </BrowserFrame>
          </div>
        </Container>
      </Section>

      <Section surface="tinted" tight>
        <Container>
          <h2>Section surface = tinted</h2>
          <p>This section uses the tinted surface variant.</p>
        </Container>
      </Section>

      <Section surface="white">
        <Container>
          <h2>FAQ</h2>
          <FAQ items={FAQ_ITEMS} />
        </Container>
      </Section>
    </>
  );
}
