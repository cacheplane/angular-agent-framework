import type { ReactNode } from 'react';
import { BrowserFrame } from './BrowserFrame';
import type { DemoClip } from '../../lib/demo-media';

interface ClipPlayerProps {
  clip: DemoClip;
  /**
   * Overlay drawn on top of the video. The homepage demo showcase put its
   * "Launch live demo" button here; that showcase was retired by the homepage
   * restructure, so no caller passes an overlay today.
   */
  overlay?: ReactNode;
  /** Address-bar text, when it should differ from the clip's own. */
  url?: string;
}

/**
 * A recorded clip in a browser frame.
 *
 * Extracted after the same markup reached three call sites — the homepage
 * sections, the (since retired) homepage demo showcase, and the solutions
 * pages — identical
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
      <div data-ui="clip-player">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={clip.poster}
          aria-label={clip.caption}
        >
          <source src={clip.videoWebm} type="video/webm" />
          <source src={clip.videoMp4} type="video/mp4" />
        </video>
        {overlay}
      </div>
    </BrowserFrame>
  );
}
