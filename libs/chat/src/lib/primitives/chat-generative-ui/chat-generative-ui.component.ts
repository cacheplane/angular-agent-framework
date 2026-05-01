// libs/chat/src/lib/primitives/chat-generative-ui/chat-generative-ui.component.ts
// SPDX-License-Identifier: MIT
import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { Spec, StateStore } from '@json-render/core';
import type { AngularRegistry, RenderEvent } from '@ngaf/render';
import { RenderSpecComponent } from '@ngaf/render';
import { CHAT_HOST_TOKENS } from '../../styles/chat-tokens';
import { CHAT_GENERATIVE_UI_STYLES } from '../../styles/chat-generative-ui.styles';

@Component({
  selector: 'chat-generative-ui',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [CHAT_HOST_TOKENS, CHAT_GENERATIVE_UI_STYLES],
  template: `
    @if (spec()) {
      <render-spec
        [spec]="spec()"
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
}
