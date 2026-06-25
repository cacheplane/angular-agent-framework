// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Marketing hero shown in sidebar mode while App mode is off. Sells the
 * App-mode map cockpit and the Threadplane primitives behind it, with a CTA
 * that enables App mode.
 *
 * Isolated contract — no shell coupling:
 *  - `hasMapsKey`: whether GOOGLE_MAPS_API_KEY is configured (gates the CTA).
 *  - `enable`: emitted when the user clicks the CTA.
 */
@Component({
  selector: 'app-mode-promo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="promo">
      <img
        class="promo__img"
        src="/app-mode-preview.webp"
        alt="Preview of the App-mode map cockpit"
        loading="lazy"
      />
      <div class="promo__caption">
        <div class="promo__copy">
          <span class="promo__eyebrow">
            <span class="promo__icon promo__icon--sm" aria-hidden="true">layers</span>
            Built with Threadplane
          </span>
          <h2 class="promo__title">See your trip come alive on a live map</h2>
          <p class="promo__subtitle">A map cockpit where the agent edits your itinerary in real time.</p>
          <ul class="promo__pills">
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">build</span>Client tools</li>
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">widgets</span>Generative UI</li>
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">how_to_reg</span>Human-in-the-loop</li>
            <li class="promo__pill"><span class="promo__icon promo__icon--sm" aria-hidden="true">database</span>Shared state</li>
          </ul>
        </div>
        <div class="promo__action">
          <button
            type="button"
            class="promo__cta"
            [disabled]="!hasMapsKey()"
            [attr.title]="hasMapsKey() ? null : 'Set GOOGLE_MAPS_API_KEY to enable'"
            (click)="enable.emit()"
          >
            <span class="promo__icon" aria-hidden="true">map</span>
            Enable app mode
            <span class="promo__icon" aria-hidden="true">arrow_forward</span>
          </button>
          @if (!hasMapsKey()) {
            <p class="promo__note">Set <code>GOOGLE_MAPS_API_KEY</code> to enable</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .promo {
      position: relative;
      width: min(780px, 100%);
      margin: 0 auto;
      aspect-ratio: 16 / 10;
      border-radius: var(--ngaf-chat-radius-card, 12px);
      overflow: hidden;
      background: #0e1626;
      border: 1px solid var(--ngaf-chat-separator, rgba(255, 255, 255, 0.12));
      animation: promo-rise 320ms ease both;
    }
    .promo__img {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; display: block;
    }
    .promo__caption {
      position: absolute; left: 0; right: 0; bottom: 0;
      display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
      padding: 16px 20px;
      background: rgba(8, 15, 28, 0.96);
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .promo__copy { flex: 1 1 320px; min-width: 0; }
    .promo__eyebrow {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(37, 99, 235, 0.18); color: #93b4f5;
      font-size: 12px; padding: 3px 10px; border-radius: 8px; margin-bottom: 9px;
    }
    .promo__title { font-size: 20px; font-weight: 600; color: #f2f5fb; line-height: 1.3; margin: 0 0 4px; }
    .promo__subtitle { font-size: 13px; color: #9aa6bd; line-height: 1.5; margin: 0 0 12px; }
    .promo__pills { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
    .promo__pill {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
      color: #c2cbdc; font-size: 12px; padding: 5px 10px; border-radius: 8px;
    }
    .promo__action { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
    .promo__cta {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--ngaf-chat-primary, #2563eb); color: var(--ngaf-chat-on-primary, #fff);
      border: none; font: inherit; font-size: 14px; font-weight: 600;
      padding: 11px 18px; border-radius: 8px; cursor: pointer;
    }
    .promo__cta:disabled { opacity: 0.5; cursor: not-allowed; }
    .promo__note { font-size: 12px; color: #9aa6bd; margin: 0; }
    .promo__note code { font-family: var(--ngaf-chat-font-mono, monospace); }
    .promo__icon { font-family: 'Material Symbols Outlined', sans-serif; font-size: 18px; line-height: 1; }
    .promo__icon--sm { font-size: 15px; }
    @keyframes promo-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .promo { animation: none; } }
  `],
})
export class AppModePromoComponent {
  /** Whether GOOGLE_MAPS_API_KEY is configured; gates the CTA. */
  readonly hasMapsKey = input<boolean>(false);
  /** Emitted when the user clicks the "Enable app mode" CTA. */
  readonly enable = output<void>();
}
