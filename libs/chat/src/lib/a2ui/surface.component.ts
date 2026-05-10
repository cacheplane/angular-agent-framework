// SPDX-License-Identifier: MIT
import {
  Component, computed, input, output, ChangeDetectionStrategy,
} from '@angular/core';
import type { A2uiSurface, A2uiActionMessage } from '@ngaf/a2ui';
import { RenderSpecComponent, toRenderRegistry } from '@ngaf/render';
import type { ViewRegistry, RenderEvent } from '@ngaf/render';
import { surfaceToSpec } from './surface-to-spec';
import { buildA2uiActionMessage } from './build-action-message';

@Component({
  selector: 'a2ui-surface',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The host applies the agent-set v1 styles (`beginRendering.styles`)
  // as inline CSS custom properties + font-family. Catalog components
  // consume `--a2ui-primary` for accents (buttons, sliders, focus,
  // etc.); `font-family` cascades naturally from the host.
  host: {
    '[style.--a2ui-primary]': 'primaryColor()',
    '[style.font-family]': 'fontFamily()',
  },
  styles: [`
    :host {
      /* === Spacing scale (4px base) === */
      --a2ui-spacing-1: 4px;
      --a2ui-spacing-2: 8px;
      --a2ui-spacing-3: 12px;
      --a2ui-spacing-4: 16px;
      --a2ui-spacing-5: 24px;
      --a2ui-spacing-6: 32px;
      --a2ui-spacing-7: 40px;

      /* === Typography (per Text usageHint) === */
      /* h1 — display heading */
      --a2ui-typography-h1-size: 32px;
      --a2ui-typography-h1-weight: 700;
      --a2ui-typography-h1-line-height: 1.2;
      /* h2 — section heading */
      --a2ui-typography-h2-size: 24px;
      --a2ui-typography-h2-weight: 600;
      --a2ui-typography-h2-line-height: 1.3;
      /* h3 — subsection heading */
      --a2ui-typography-h3-size: 20px;
      --a2ui-typography-h3-weight: 600;
      --a2ui-typography-h3-line-height: 1.3;
      /* h4 */
      --a2ui-typography-h4-size: 18px;
      --a2ui-typography-h4-weight: 500;
      --a2ui-typography-h4-line-height: 1.4;
      /* h5 */
      --a2ui-typography-h5-size: 16px;
      --a2ui-typography-h5-weight: 500;
      --a2ui-typography-h5-line-height: 1.4;
      /* body */
      --a2ui-typography-body-size: 14px;
      --a2ui-typography-body-weight: 400;
      --a2ui-typography-body-line-height: 1.5;
      /* caption */
      --a2ui-typography-caption-size: 12px;
      --a2ui-typography-caption-weight: 400;
      --a2ui-typography-caption-line-height: 1.4;
      /* label (used by TextField/Slider/etc. labels) */
      --a2ui-typography-label-size: 12px;
      --a2ui-typography-label-weight: 500;

      /* === Shape radius === */
      --a2ui-shape-extra-small: 4px;
      --a2ui-shape-small: 8px;
      --a2ui-shape-medium: 12px;
      --a2ui-shape-large: 16px;
      --a2ui-shape-extra-large: 28px;

      /* === Focus ring === */
      --a2ui-focus-ring-color: var(--a2ui-primary);
      --a2ui-focus-ring-width: 2px;

      /* === Motion === */
      --a2ui-motion-duration-short: 100ms;
      --a2ui-motion-duration-medium: 200ms;
      --a2ui-motion-duration-long: 300ms;
      --a2ui-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
      --a2ui-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1.4);

      /* === Elevation (box-shadow) === */
      --a2ui-elevation-0: none;
      --a2ui-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3);
      --a2ui-elevation-2: 0 2px 4px rgba(0, 0, 0, 0.35);
      --a2ui-elevation-3: 0 4px 8px rgba(0, 0, 0, 0.4);
      --a2ui-elevation-4: 0 8px 16px rgba(0, 0, 0, 0.45);
      --a2ui-elevation-5: 0 16px 32px rgba(0, 0, 0, 0.5);

      /* === Color === */
      /* (--a2ui-primary is set by host binding from beginRendering.styles, default below) */
      --a2ui-primary: #4f8df5;
      --a2ui-on-primary: #ffffff;
      --a2ui-primary-hover: #6699f7;
      --a2ui-secondary: #8a92a3;
      --a2ui-on-secondary: #ffffff;
      --a2ui-surface: #1a1d23;
      --a2ui-on-surface: #ffffff;
      --a2ui-surface-variant: rgba(255, 255, 255, 0.05);
      --a2ui-on-surface-variant: rgba(255, 255, 255, 0.7);
      --a2ui-outline: rgba(255, 255, 255, 0.1);
      --a2ui-outline-variant: rgba(255, 255, 255, 0.05);
      --a2ui-error: #f5524f;
      --a2ui-on-error: #ffffff;
      --a2ui-scrim: rgba(0, 0, 0, 0.6);

      /* === Carry-over from existing tokens (kept for back-compat) === */
      --a2ui-card-bg: var(--a2ui-surface);
      --a2ui-input-bg: var(--a2ui-surface-variant);
      --a2ui-input-text: var(--a2ui-on-surface);
      --a2ui-label: var(--a2ui-on-surface-variant);
      --a2ui-caption: var(--a2ui-on-surface-variant);
      --a2ui-border: var(--a2ui-outline);
    }
  `],
  template: `
    @if (spec(); as s) {
      <render-spec
        [spec]="s"
        [registry]="registry()"
        [handlers]="internalHandlers()"
        (events)="onRenderEvent($event)"
      />
    }
  `,
})
export class A2uiSurfaceComponent {
  readonly surface = input.required<A2uiSurface>();
  readonly catalog = input.required<ViewRegistry>();
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  readonly events = output<RenderEvent>();
  readonly action = output<A2uiActionMessage>();

  /** Agent-set primary color from `beginRendering.styles.primaryColor`.
   * Returns null when unset so the host binding doesn't override the
   * consumer's `:root`-level `--a2ui-primary` default. */
  readonly primaryColor = computed<string | null>(() =>
    this.surface().styles?.primaryColor ?? null
  );

  /** Agent-set font family from `beginRendering.styles.font`. Returns
   * null when unset so the host doesn't override consumer fonts. */
  readonly fontFamily = computed<string | null>(() =>
    this.surface().styles?.font ?? null
  );

  /** Convert the A2UI surface to a json-render Spec for rendering. */
  readonly spec = computed(() => surfaceToSpec(this.surface()));

  /** Convert ViewRegistry to AngularRegistry for RenderSpecComponent. */
  readonly registry = computed(() => toRenderRegistry(this.catalog()));

  /** Merge built-in A2UI handlers with consumer-provided handlers. */
  readonly internalHandlers = computed(() => {
    const consumerHandlers = this.handlers();
    return {
      'a2ui:event': (params: Record<string, unknown>) => {
        const message = buildA2uiActionMessage(params, this.surface());
        this.action.emit(message);
        return message;
      },
      'a2ui:localAction': (params: Record<string, unknown>) => {
        const call = params['call'] as string;
        const args = (params['args'] as Record<string, unknown>) ?? {};

        // Consumer handler takes priority
        if (consumerHandlers[call]) {
          return consumerHandlers[call](args);
        }

        // Built-in fallback
        if (call === 'openUrl' && typeof globalThis.window !== 'undefined') {
          globalThis.window.open(String(args['url'] ?? ''), '_blank');
        }
        return undefined;
      },
    };
  });

  onRenderEvent(event: RenderEvent): void {
    this.events.emit(event);
  }
}
