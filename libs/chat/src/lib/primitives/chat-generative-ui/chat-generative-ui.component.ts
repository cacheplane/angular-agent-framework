// libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  computed,
  effect,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { Spec, StateStore } from '@json-render/core';
import type { AngularRegistry, RenderEvent } from '@threadplane/render';
import { RenderSpecComponent } from '@threadplane/render';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_GENERATIVE_UI_STYLES } from '../../styles/chat-generative-ui.styles';
import { normalizeJsonRenderSpec } from './normalize-json-render-spec';

@Component({
  selector: 'chat-generative-ui',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_GENERATIVE_UI_STYLES],
  template: `
    @if (normalizedSpec()) {
      <render-spec
        [spec]="normalizedSpec()"
        [registry]="registry()"
        [store]="store()"
        [handlers]="handlers()"
        [loading]="loading()"
        (events)="events.emit($event)"
      />
    }
  `,
})
export class ChatGenerativeUiComponent {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>> | undefined>(undefined);
  readonly loading = input<boolean>(false);
  readonly events = output<RenderEvent>();

  /** The bound spec with schema-documented `{ statePath }` prop refs
   * rewritten to engine-native `{ $bindState }` + `_bindings` so values
   * resolve against the state store instead of interpolating as
   * "[object Object]" (F4). */
  protected readonly normalizedSpec = computed(() => {
    const s = this.spec();
    return s ? normalizeJsonRenderSpec(s) : null;
  });

  /** Last value this component seeded per state path. Lets the seeding
   * effect distinguish "still the value we wrote (possibly a partial
   * chunk from streaming — safe to overwrite with the newer one)" from
   * "user edited it via a bound control — leave it alone". */
  private readonly seeded = new Map<string, unknown>();

  constructor() {
    // Seed `spec.state` (the schema's "initial state model") into the
    // store. When the chat composition supplies its shared store, it is
    // initially EMPTY — render-spec only seeds spec.state into its own
    // internal store when no store input is given — so without this,
    // statePath/$bindState props would resolve to undefined.
    effect(() => {
      const s = this.spec();
      const store = this.store();
      const state = s?.state as Record<string, unknown> | undefined;
      if (!state || !store) return;
      for (const [key, value] of Object.entries(state)) {
        const path = key.startsWith('/') ? key : `/${key}`;
        const current = store.get(path);
        const untouched =
          current === undefined ||
          (this.seeded.has(path) && current === this.seeded.get(path));
        if (untouched) {
          if (current !== value) store.set(path, value);
          this.seeded.set(path, value);
        }
      }
    });
  }
}
