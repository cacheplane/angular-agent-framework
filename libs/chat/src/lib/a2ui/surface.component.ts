// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component, computed, input, output, ChangeDetectionStrategy,
} from '@angular/core';
import type { A2uiSurface, A2uiActionMessage } from '@cacheplane/a2ui';
import { RenderSpecComponent, toRenderRegistry } from '@cacheplane/render';
import type { ViewRegistry, RenderEvent } from '@cacheplane/render';
import { surfaceToSpec } from './surface-to-spec';

/** Builds a v0.9 A2uiActionMessage from handler params and the current surface. */
export function buildA2uiActionMessage(
  params: Record<string, unknown>,
  surface: A2uiSurface,
): A2uiActionMessage {
  const message: A2uiActionMessage = {
    version: 'v0.9',
    action: {
      name: params['name'] as string,
      surfaceId: surface.surfaceId,
      sourceComponentId: params['sourceComponentId'] as string,
      timestamp: new Date().toISOString(),
      context: (params['context'] as Record<string, unknown>) ?? {},
    },
  };
  if (surface.sendDataModel) {
    message.metadata = {
      a2uiClientDataModel: {
        version: 'v0.9',
        surfaces: { [surface.surfaceId]: surface.dataModel },
      },
    };
  }
  return message;
}

@Component({
  selector: 'a2ui-surface',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
