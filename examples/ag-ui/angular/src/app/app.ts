// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAgent } from '@threadplane/ag-ui';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
  a2uiBasicCatalog,
  type InterruptAction,
} from '@threadplane/chat';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatComponent, ChatInterruptPanelComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly agent = injectAgent();
  // The a2ui-surface render block in <chat> is gated on a truthy `views`
  // catalog — without it, a2ui surfaces parse but never mount and the
  // render_a2ui_surface tool call shows only as a tool chip (issue #616).
  protected readonly catalog = a2uiBasicCatalog();

  /**
   * Resolve a human-in-the-loop interrupt (request_approval). The
   * chat-interrupt-panel emits a four-action vocabulary; map each to a resume
   * payload and replay the run via AG-UI's resume path — `submit({ resume })`,
   * which the adapter forwards as `forwardedProps.command.resume`. `edit` /
   * `respond` use window.prompt as a demo affordance; a production app would
   * inline a textarea editor.
   */
  protected async onInterruptAction(action: InterruptAction): Promise<void> {
    const interrupt = this.agent.interrupt?.();
    if (!interrupt) return;

    let resume: unknown;
    switch (action) {
      case 'accept':
        resume = 'approved';
        break;
      case 'edit': {
        const reason = (interrupt.value as { reason?: string })?.reason ?? '';
        const edited = window.prompt(`Edit your response (current proposal: "${reason}"):`, 'approved');
        if (edited == null) return;
        resume = edited;
        break;
      }
      case 'respond': {
        const text = window.prompt('Respond to the agent:', '');
        if (text == null) return;
        resume = text;
        break;
      }
      case 'ignore':
        resume = 'denied';
        break;
    }

    await this.agent.submit({ resume });
  }
}
