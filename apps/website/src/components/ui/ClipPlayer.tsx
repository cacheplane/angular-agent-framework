// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react';
import { BrowserFrame } from './BrowserFrame';
import type { DemoClip } from '../../lib/demo-media';

interface ClipPlayerProps {
  clip: DemoClip;
  /**
   * Overlay drawn on top of the video — the homepage showcase puts its
   * "Launch live demo" button here. Absent everywhere else.
   */
  overlay?: ReactNode;
  /** Address-bar text, when it should differ from the clip's own. */
  url?: string;
}

/**
 * A recorded clip in a browser frame.
 *
 * Extracted after the same markup reached three call sites — the homepage
 * sections, the homepage demo showcase, and the solutions pages — identical
 * down to the inline styles. `DemoClip` already gave them a common shape, so
 * the duplication bought nothing.
 *
 * Silent and decorative: no audio track, no narration, so `aria-label` carries
 * the description and there is nothing for captions to caption. Callers mount
 * this only when its pane is active, which is what keeps a page with several
 * clips from fetching all of them at once.
 */
export function ClipPlayer({ clip, overlay, url }: ClipPlayerProps) {
  return (
    <BrowserFrame url={url ?? clip.url} elevation="lg">
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          background: '#15161f',
        }}
      >
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
        {overlay}
      </div>
    </BrowserFrame>
  );
}
