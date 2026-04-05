// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  Component,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { Spec, StateStore } from '@json-render/core';
import type { AngularRegistry } from '@cacheplane/render';
import { RenderSpecComponent } from '@cacheplane/render';

@Component({
  selector: 'chat-generative-ui',
  standalone: true,
  imports: [RenderSpecComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (spec()) {
      <render-spec
        [spec]="spec()"
        [registry]="registry()"
        [store]="store()"
        [loading]="loading()"
      />
    }
  `,
})
export class ChatGenerativeUiComponent {
  readonly spec = input<Spec | null>(null);
  readonly registry = input<AngularRegistry | undefined>(undefined);
  readonly store = input<StateStore | undefined>(undefined);
  readonly loading = input<boolean>(false);
}
