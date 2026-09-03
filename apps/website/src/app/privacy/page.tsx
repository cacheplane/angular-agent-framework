// SPDX-License-Identifier: MIT
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { createPageMetadata } from '../../lib/site-metadata';

const CONTACT_EMAIL = 'brian@threadplane.ai';

export const metadata = createPageMetadata({
  title: 'Privacy — Threadplane',
  description:
    'What Threadplane collects, why, who processes it, how long it is kept, and how to opt out or request deletion.',
  pathname: '/privacy',
  type: 'website',
});

/**
 * The single canonical statement of what Threadplane collects and why.
 *
 * It deliberately describes categories and purposes rather than an event or
 * property catalog. A catalog would be a maintenance trap: it goes stale the
 * first time an event is added, and a stale published catalog is worse than a
 * general one. For the same reason this page makes no claim about behavior it
 * cannot continuously verify.
 */
export default function PrivacyPage() {
  return (
    <Section surface="canvas" ariaLabelledBy="privacy-heading">
      <Container>
        <div className="privacy-inner">
          <Eyebrow tone="accent" className="privacy-eyebrow">Legal</Eyebrow>
          <h1 id="privacy-heading" className="privacy-h1">
            Privacy
          </h1>
          <p className="privacy-body">
            This page describes what Threadplane collects, why it is collected,
            who processes it, and the choices available to you. It applies to
            the Threadplane website and to the Threadplane software libraries
            and services.
          </p>

          <h2 className="privacy-h2">Information you submit</h2>
          <p className="privacy-body">
            When you request a guide, subscribe to updates, or contact us, we
            receive what you enter in the form: your email address and, where
            the form asks for them, your name, company, and message. Replies you
            send to our email are received and read as ordinary correspondence.
          </p>

          <h2 className="privacy-h2">Website analytics</h2>
          <p className="privacy-body">
            We record how pages are used — pages viewed, referring source, and
            broad technical details such as browser and approximate region — to
            understand what people find useful. This is used in aggregate.
          </p>

          <h2 className="privacy-h2">Product analytics</h2>
          <p className="privacy-body">
            Threadplane software may report operational facts about how the
            product is running so we can see which capabilities work in real
            deployments. These reports describe activity, not content. We do not
            want and do not seek the substance of what your application is
            doing: prompts, messages, tool inputs and outputs, application
            state, and source code are outside what this reporting is designed
            to carry.
          </p>

          <h2 className="privacy-h2">How the information is used</h2>
          <p className="privacy-body">
            To operate and support the product, to understand and improve how it
            is used, to answer you when you get in touch, and — where you have
            asked to hear from us — to send relevant email.
          </p>

          <h2 className="privacy-h2">Who processes it</h2>
          <p className="privacy-body">
            Threadplane relies on a small number of service providers who
            process data on our behalf: Vercel (hosting), Neon (database),
            PostHog (analytics), Resend (email delivery), Google (business email
            and calendar), and Anthropic (AI processing used to prepare internal
            summaries). Each processes data under its own agreement with us and
            for our purposes only.
          </p>

          <h2 className="privacy-h2">Retention</h2>
          <p className="privacy-body">
            Information is retained indefinitely by default, so that account and
            correspondence history stays intact. Where you ask us to delete
            information, we do so as described below.
          </p>

          <h2 className="privacy-h2">Your choices</h2>
          <p className="privacy-body">
            Every marketing email carries an unsubscribe link, and unsubscribing
            stops further marketing email. Replying to ask us to stop has the
            same effect. To request deletion of the information we hold about
            you, or to ask what that is, email{' '}
            <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
            act on it. Some records are kept where we are required to keep them.
          </p>

          <h2 className="privacy-h2">Security</h2>
          <p className="privacy-body">
            Data is held with the providers named above, protected in transit
            and at rest by their standard controls, and access is limited to
            those who need it to run the product.
          </p>

          <h2 className="privacy-h2">International processing</h2>
          <p className="privacy-body">
            Our providers operate in the United States and elsewhere, so
            information may be processed outside the country where you live.
          </p>

          <h2 className="privacy-h2">Changes</h2>
          <p className="privacy-body">
            When this page changes materially, the change applies from the date
            it is published here.
          </p>

          <h2 className="privacy-h2">Contact</h2>
          <p className="privacy-body">
            Questions about this page or about the information we hold:{' '}
            <a className="privacy-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      </Container>
    </Section>
  );
}
