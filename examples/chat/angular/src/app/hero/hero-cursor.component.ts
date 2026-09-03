// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The scripted pointer. Purely decorative: aria-hidden, pointer-events none,
 * moved with a CSS transition on transform (disabled under reduced motion).
 */
@Component({
  selector: 'hero-cursor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-visible]': 'visible()',
    '[attr.data-pressed]': 'pressed()',
    '[style.transform]': '"translate(" + x() + "px, " + y() + "px)"',
  },
  template: `
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M4 2l6 18 2.6-7.4L20 10z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  `,
  styles: [
    `
      :host {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 20;
        pointer-events: none;
        opacity: 0;
        transition: transform 600ms cubic-bezier(.2,.7,.2,1), opacity 200ms ease;
      }
      :host([data-visible='true']) {
        opacity: 1;
        will-change: transform;
      }
      :host([data-pressed='true']) svg {
        transform: scale(.85);
      }
      @media (prefers-reduced-motion: reduce) {
        :host {
          transition: opacity 200ms ease;
        }
      }
    `,
  ],
})
export class HeroCursorComponent {
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly visible = input<boolean>(false);
  readonly pressed = input<boolean>(false);
}
