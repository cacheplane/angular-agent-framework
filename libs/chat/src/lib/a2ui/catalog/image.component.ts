// SPDX-License-Identifier: MIT
import { Component, input } from '@angular/core';
import type { Spec } from '@json-render/core';

/** v1 fit values mapped 1:1 to CSS object-fit. */
type ImageFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

/** v1 usageHint maps to a sizing preset. The component renders fluid by
 * default; usageHint sets a max-width / aspect-ratio to match common
 * intents. */
type ImageUsageHint = 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header';

const USAGE_HINT_STYLE: Record<ImageUsageHint, { maxWidth: string; aspectRatio?: string; borderRadius?: string }> = {
  icon:          { maxWidth: '24px', aspectRatio: '1 / 1' },
  avatar:        { maxWidth: '48px', aspectRatio: '1 / 1', borderRadius: '50%' },
  smallFeature:  { maxWidth: '160px' },
  mediumFeature: { maxWidth: '320px' },
  largeFeature:  { maxWidth: '480px' },
  header:        { maxWidth: '100%', aspectRatio: '16 / 5' },
};

@Component({
  selector: 'a2ui-image',
  standalone: true,
  template: `
    <img
      class="a2ui-img"
      [src]="url()"
      [alt]="alt()"
      [style.width]="explicitWidth()"
      [style.height]="explicitHeight()"
      [style.object-fit]="fit()"
      [style.max-width]="hintStyle()?.maxWidth"
      [style.aspect-ratio]="hintStyle()?.aspectRatio || null"
      [style.border-radius]="hintStyle()?.borderRadius || null"
    />
  `,
  styles: [`
    .a2ui-img {
      display: block;
      max-width: 100%;
      border-radius: var(--a2ui-shape-extra-small);
    }
  `],
})
export class A2uiImageComponent {
  readonly url = input<string>('');
  readonly alt = input<string>('');
  readonly width = input<number | null>(null);
  readonly height = input<number | null>(null);
  /** v1 prop: CSS object-fit equivalent. */
  readonly fit = input<ImageFit | undefined>(undefined);
  /** v1 prop: sizing preset. */
  readonly usageHint = input<ImageUsageHint | undefined>(undefined);
  // Framework inputs required by the render harness.
  readonly bindings = input<Record<string, string>>({});
  readonly emit = input<(event: string) => void>(() => { /* noop */ });
  readonly loading = input<boolean>(false);
  readonly childKeys = input<string[]>([]);
  readonly spec = input<Spec | undefined>(undefined);

  protected explicitWidth(): string | null {
    return this.width() != null ? this.width() + 'px' : null;
  }
  protected explicitHeight(): string | null {
    return this.height() != null ? this.height() + 'px' : null;
  }
  protected hintStyle(): { maxWidth: string; aspectRatio?: string; borderRadius?: string } | null {
    const h = this.usageHint();
    return h ? USAGE_HINT_STYLE[h] : null;
  }
}
