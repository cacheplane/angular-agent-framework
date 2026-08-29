import { Container } from '../components/ui/Container';
import { Section } from '../components/ui/Section';
import { Eyebrow } from '../components/ui/Eyebrow';
import { Button } from '../components/ui/Button';

export const metadata = {
  title: 'Page not found — Threadplane',
  description: 'The page you were looking for doesn’t exist.',
};

export default function NotFound() {
  return (
    <Section surface="canvas" ariaLabelledBy="not-found-heading">
      <Container>
        <div className="nf-inner">
          <Eyebrow tone="accent" className="nf-eyebrow-spaced">404</Eyebrow>
          <h1 id="not-found-heading" className="nf-h1">
            Page not found.
          </h1>
          <p className="nf-body">
            The page you were looking for doesn&apos;t exist. It may have moved, or the link
            you followed might be broken.
          </p>
          <div className="nf-buttons">
            <Button variant="primary" size="lg" href="/">
              Back home
            </Button>
            <Button variant="secondary" size="lg" href="/docs">
              Browse docs
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
