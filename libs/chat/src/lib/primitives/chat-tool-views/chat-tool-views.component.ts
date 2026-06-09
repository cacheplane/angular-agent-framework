// libs/chat/src/lib/primitives/chat-tool-views/chat-tool-views.component.ts
// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Spec, StateStore } from '@json-render/core';
import type { RenderEvent, ViewRegistry } from '@threadplane/render';
import { toRenderRegistry } from '@threadplane/render';
import type { Agent, Message, ToolCall } from '../../agent';
import { resolveMessageToolCalls } from '../chat-tool-calls/resolve-message-tool-calls';
import { ChatGenerativeUiComponent } from '../chat-generative-ui/chat-generative-ui.component';

/**
 * Renders a frontend component for a tool call by reusing the chat
 * composition's `views` registry. A tool call whose `name` matches a
 * registry key is bridged into a synthetic one-element render spec
 * (`{ root: name, elements: { [name]: { type: name, props } } }`) and
 * rendered through the existing render-spec pipeline.
 *
 * Props merge the live `args` (present while the call streams) with the
 * `result` (on completion) and always include `status`, so a view
 * component can show its own loading/empty/error states. `RenderElement`
 * filters props down to the component's declared inputs, so extra keys
 * (and a `status` a component chooses not to declare) are harmless.
 */
@Component({
  selector: 'chat-tool-views',
  standalone: true,
  imports: [ChatGenerativeUiComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (view of toolViews(); track view.id) {
      <chat-generative-ui
        [spec]="view.spec"
        [registry]="registry()"
        [store]="store()"
        [handlers]="handlers()"
        [loading]="view.loading"
        (events)="events.emit($event)"
      />
    }
  `,
})
export class ChatToolViewsComponent {
  readonly agent = input.required<Agent>();
  readonly events = output<RenderEvent>();
  readonly message = input<Message | undefined>(undefined);
  readonly views = input<ViewRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly handlers = input<Record<string, (params: Record<string, unknown>) => unknown | Promise<unknown>>>({});

  readonly registry = computed(() => {
    const v = this.views();
    return v ? toRenderRegistry(v) : undefined;
  });

  readonly toolViews = computed(() => {
    const v = this.views();
    if (!v) return [];
    const names = new Set(Object.keys(v));
    return resolveMessageToolCalls(this.agent(), this.message())
      .filter((tc) => names.has(tc.name))
      .map((tc) => ({ id: tc.id, loading: tc.status === 'running', spec: toToolViewSpec(tc) }));
  });
}

/** Wraps a tool call into a synthetic single-element render spec. */
function toToolViewSpec(tc: ToolCall): Spec {
  const args = isRecord(tc.args) ? tc.args : {};
  const result = isRecord(tc.result) ? tc.result : {};
  return {
    root: tc.name,
    elements: {
      [tc.name]: {
        type: tc.name,
        props: { ...args, ...result, status: tc.status },
      },
    },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
