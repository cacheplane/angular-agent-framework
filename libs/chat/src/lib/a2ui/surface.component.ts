// SPDX-License-Identifier: MIT
import {
  Component, computed, input, output, ChangeDetectionStrategy, Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { A2uiSurface, A2uiActionMessage } from '@threadplane/a2ui';
import { RenderSpecComponent, toRenderRegistry } from '@threadplane/render';
import type { ViewRegistry, RenderEvent } from '@threadplane/render';
import { surfaceToSpec } from './surface-to-spec';
import { buildA2uiActionMessage } from './build-action-message';
import { A2uiDefaultFallbackComponent } from './a2ui-default-fallback.component';
import type { A2uiSurfaceState } from './surface-store';
import type { A2uiViews } from './views';

@Component({
  selector: 'a2ui-surface',
  standalone: true,
  imports: [
    RenderSpecComponent,
    A2uiDefaultFallbackComponent,
    NgComponentOutlet,
  ],
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
    } @else if (state(); as st) {
      @if (surfaceFallback(); as fb) {
        <ng-container *ngComponentOutlet="fb" />
      } @else {
        <a2ui-default-fallback />
      }
    }
  `,
})
/**
 * Renders an A2UI surface. Supports two input shapes:
 * - `state` (preferred): chat-side `A2uiSurfaceState` driving progressive
 *   per-component rendering via `a2uiSlot` + readiness gates.
 * - `surface` (legacy): wire-format `A2uiSurface` fed into `<render-spec>`;
 *   kept for backwards compatibility.
 *
 * When both inputs are set, `state` takes priority for rendering AND for
 * action-message construction; `surface` is only consulted when `state`
 * is unset.
 */
export class A2uiSurfaceComponent {
  /** Wire-format surface (legacy path — kept for backwards compat). */
  readonly surface = input<A2uiSurface>();
  /** Chat-side surface state with per-component readiness. When set,
   * this takes priority and the progressive renderer is used. */
  readonly state = input<A2uiSurfaceState>();
  readonly catalog = input.required<A2uiViews | ViewRegistry>();
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});
  /** Optional top-level placeholder when the surface has no components
   * yet. Defaults to A2uiDefaultFallbackComponent. */
  readonly surfaceFallback = input<Type<unknown> | undefined>(undefined);
  readonly events = output<RenderEvent>();
  readonly action = output<A2uiActionMessage>();

  /** Agent-set primary color from `beginRendering.styles.primaryColor`.
   * Returns null when unset so the host binding doesn't override the
   * consumer's `:root`-level `--a2ui-primary` default. */
  readonly primaryColor = computed<string | null>(() =>
    (this.state()?.surface ?? this.surface())?.styles?.primaryColor ?? null
  );

  /** Agent-set font family from `beginRendering.styles.font`. Returns
   * null when unset so the host doesn't override consumer fonts. */
  readonly fontFamily = computed<string | null>(() =>
    (this.state()?.surface ?? this.surface())?.styles?.font ?? null
  );

  /** Roots from the surface state — components whose ids appear as
   * children of no other component. The wire spec includes
   * `beginRendering.root` as the single root; that path stays usable
   * but we keep the renderer permissive in case future surfaces emit
   * multiple top-level components.
   *
   * Conservative: returns only the first key from componentViews
   * insertion order. The wire format's beginRendering.root carries the
   * true root id; plumbing it through A2uiSurfaceState is a follow-up. */
  readonly rootIds = computed<string[]>(() => {
    const st = this.state();
    if (!st) return [];
    return [...st.componentViews.keys()].slice(0, 1);
  });

  /** Convert the A2UI surface to a json-render Spec for rendering.
   *  Prefers `state().surface` (the progressively-built wire surface)
   *  over the legacy `surface` input. surfaceToSpec handles
   *  children.explicitList → spec.children translation + reserved-key
   *  filtering + path-ref → $bindState rewriting; the rendered tree
   *  then uses render-element's standard input-mapping
   *  (`childKeys: el.children`) so catalog components receive the
   *  inputs they actually declare.
   *
   *  This supersedes the earlier slot-based progressive renderer,
   *  which mounted root components but never populated their
   *  childKeys input — leaving Columns/Rows/etc. with no children. */
  readonly spec = computed(() => {
    const surf = this.state()?.surface ?? this.surface();
    return surf && surf.components.size > 0 ? surfaceToSpec(surf) : null;
  });

  /** Convert ViewRegistry to AngularRegistry for RenderSpecComponent. */
  readonly registry = computed(() => toRenderRegistry(this.catalog() as ViewRegistry));

  /** Merge built-in A2UI handlers with consumer-provided handlers. */
  readonly internalHandlers = computed(() => {
    const consumerHandlers = this.handlers();
    return {
      'a2ui:event': (params: Record<string, unknown>) => {
        // Prefer state.surface so action messages reference the surface
        // we actually rendered, even if a legacy `[surface]` input with
        // a mismatched id is also bound.
        const surf = this.state()?.surface ?? this.surface();
        if (!surf) return undefined;
        const message = buildA2uiActionMessage(params, surf);
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
