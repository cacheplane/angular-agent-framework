// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAgent } from '@threadplane/ag-ui';
import { ChatComponent, a2uiBasicCatalog } from '@threadplane/chat';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly agent = injectAgent();
  // The a2ui-surface render block in <chat> is gated on a truthy `views`
  // catalog — without it, a2ui surfaces parse but never mount and the
  // render_a2ui_surface tool call shows only as a tool chip (issue #616).
  protected readonly catalog = a2uiBasicCatalog();
}
