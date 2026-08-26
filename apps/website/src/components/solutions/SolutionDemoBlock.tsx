// SPDX-License-Identifier: MIT
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { BrowserFrame } from '../ui/BrowserFrame';
import type { DemoClip } from '../../lib/demo-media';

/**
 * A recorded clip on a solutions page, shown after the code.
 *
 * Deliberately NOT the homepage `DemoShowcase`: that one is a tabbed switcher
 * with a play overlay that opens the live demo in a modal. Neither fits here —
 * there is one clip and no second runtime to switch between, and the live demo
 * opens on an empty thread rather than on the flow this clip is about, so a
 * "Launch live demo" button would promise something the destination does not
 * deliver. A link under the frame says the same thing honestly.
 *
 * No client JS: `autoPlay muted loop playsInline` is the whole behaviour, so
 * this stays a Server Component.
 */
export function SolutionDemoBlock({ clip, accent }: { clip: DemoClip; accent: string }) {
  return (
    <Section surface="tinted" ariaLabelledBy="solution-demo-heading">
      <Container>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <Eyebrow style={{ color: accent, marginBottom: 12 }}>See it running</Eyebrow>
          <h2
            id="solution-demo-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 12,
              letterSpacing: '-0.015em',
            }}
          >
            The approval gate, in the product
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 0 20px',
              maxWidth: '62ch',
            }}
          >
            {clip.caption}
          </p>

          <BrowserFrame url={clip.url} elevation="lg">
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 10', background: '#15161f' }}>
              {/*
                Silent, decorative loop. `aria-label` rather than captions: there
                is no audio track and no narration to caption, and the prose
                above already states what the clip shows.
              */}
              <video
                autoPlay
                muted
                loop
                playsInline
                poster={clip.poster}
                aria-label={clip.caption}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              >
                <source src={clip.videoWebm} type="video/webm" />
                <source src={clip.videoMp4} type="video/mp4" />
              </video>
            </div>
          </BrowserFrame>

          <p
            style={{
              fontFamily: tokens.typography.body.family,
              fontSize: tokens.typography.body.size,
              color: tokens.colors.textMuted,
              margin: '14px 0 0',
            }}
          >
            Recorded from the{' '}
            <a
              href="https://demo.threadplane.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: tokens.colors.accent }}
            >
              live demo
            </a>
            , which you can drive yourself.
          </p>
        </div>
      </Container>
    </Section>
  );
}
