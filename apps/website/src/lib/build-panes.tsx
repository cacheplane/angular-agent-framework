import { BrowserFrame } from '../components/ui/BrowserFrame';
import { ClipPlayer } from '../components/ui/ClipPlayer';
import { HighlightedCode } from '../components/landing/HighlightedCode';
import type { MediumPane } from '../components/landing/MediumSwitcher';
import type { SectionMedia } from './section-media';

/**
 * Builds the panes for a section on the SERVER.
 *
 * `HighlightedCode` is an async Server Component, so it cannot be rendered from
 * inside the client `MediumSwitcher`. Highlighting here and passing the result
 * as a prop is what makes the code tab possible at all.
 */
export async function buildPanes(media: SectionMedia, clipUrl: string): Promise<MediumPane[]> {
  // Typed, not inferred: `const panes = []` is `any[]` under this tsconfig and
  // fails the production build's type check.
  const panes: MediumPane[] = [];

  if (media.video) {
    const clip = media.video;
    panes.push({
      id: 'video',
      key: 'video',
      label: 'Video',
      content: <ClipPlayer clip={clip} url={clipUrl} />,
    });
  }

  const codeBlocks = media.code ?? [];
  codeBlocks.forEach((block, index) => {
    panes.push({
      id: `code-${index}`,
      key: 'code',
      label: codeBlocks.length > 1 ? block.label : 'Code',
      content: (
        <div className="home-code-frame">
          <HighlightedCode code={block.source} lang={block.language} />
        </div>
      ),
    });
  });

  if (media.live) {
    const mode = media.live.mode ?? 'embed';
    panes.push({
      id: 'live',
      key: 'live',
      label: 'Live',
      content: (
        <BrowserFrame url={clipUrl} elevation="lg">
          <div className="home-live-frame">
            {/*
              Mounted only when its tab is selected — `MediumSwitcher` renders
              one pane at a time, so this iframe is never requested on page load.
              `?featured=` opens the demo on this section's own scenario; the id
              is a key into the demo's curated list, so an unknown one falls back
              rather than rendering anything this URL supplies.
            */}
            <iframe
              src={`https://demo.threadplane.ai/${mode}?featured=${encodeURIComponent(media.live.featured)}`}
              title="Threadplane live demo"
              loading="lazy"
              className="home-live-iframe"
            />
          </div>
        </BrowserFrame>
      ),
    });
  }

  return panes;
}
