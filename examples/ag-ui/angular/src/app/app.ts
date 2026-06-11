// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAgent } from '@threadplane/ag-ui';
import {
  ChatComponent,
  ChatInterruptPanelComponent,
  ChatWelcomeSuggestionComponent,
  a2uiBasicCatalog,
  type InterruptAction,
} from '@threadplane/chat';
import { ItineraryPanelComponent } from './itinerary-panel.component';
import { itineraryClientTools } from './client-tools';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChatComponent,
    ChatInterruptPanelComponent,
    ChatWelcomeSuggestionComponent,
    ItineraryPanelComponent,
  ],
  templateUrl: './app.html',
})
export class App {
  protected readonly agent = injectAgent();
  // The a2ui-surface render block in <chat> is gated on a truthy `views`
  // catalog — without it, a2ui surfaces parse but never mount and the
  // render_a2ui_surface tool call shows only as a tool chip (issue #616).
  protected readonly catalog = a2uiBasicCatalog();

  // Built in an injection context (field initializer) so itineraryClientTools()
  // can inject the shared ItineraryStore. These declare what the agent can do
  // to the page; the browser executes each call against the same store the
  // panel renders.
  protected readonly clientTools = itineraryClientTools();

  // Welcome chips spanning the demo's full capability surface — docs/citations,
  // generative UI, human approval, the five itinerary client tools, and the
  // research subagent. Selecting one submits its prompt verbatim.
  protected readonly suggestions = [
    { label: 'Docs & citations', value: 'What do the docs say about streaming?' },
    { label: 'Generative UI', value: 'Build me a revenue dashboard' },
    { label: 'Human approval', value: 'Issue me a $50 refund' },
    { label: 'Read my itinerary', value: "What's on my itinerary?" },
    { label: 'Agent edits the page', value: 'Add the Louvre to day 2 of my trip' },
    { label: 'Consent-gated clear', value: 'Clear my day 2 plans' },
    { label: 'Research subagent', value: 'Research AG-UI and give me the highlights' },
  ];

  protected send(value: string): void {
    void this.agent.submit({ message: value });
  }

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
