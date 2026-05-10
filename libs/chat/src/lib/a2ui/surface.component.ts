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
