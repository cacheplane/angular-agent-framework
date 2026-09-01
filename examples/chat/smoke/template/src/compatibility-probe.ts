// SPDX-License-Identifier: MIT

import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  injectAgent as injectAgUiAgent,
  provideFakeAgent,
} from '@threadplane/ag-ui';
import { ChatComponent } from '@threadplane/chat';
import { provideAgent as provideLangGraphAgent } from '@threadplane/langgraph';
import { RenderSpecComponent } from '@threadplane/render';
import { provideThreadplaneTelemetry } from '@threadplane/telemetry/browser';

const PACKAGE_REFS = [
  ['chat', ChatComponent],
  ['langgraph', provideLangGraphAgent],
  ['render', RenderSpecComponent],
  ['telemetry', provideThreadplaneTelemetry],
] as const;

@Component({
  selector: 'threadplane-compatibility-probe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aside aria-label="Threadplane compatibility probes">
    <span data-threadplane-compatibility="ag-ui">{{
      agUiReady ? 'AG-UI ready' : 'AG-UI unavailable'
    }}</span>
    <span data-threadplane-compatibility="chat">{{
      packageReady('chat') ? 'chat ready' : 'chat unavailable'
    }}</span>
    <span data-threadplane-compatibility="langgraph">{{
      packageReady('langgraph') ? 'langgraph ready' : 'langgraph unavailable'
    }}</span>
    <span data-threadplane-compatibility="render">{{
      packageReady('render') ? 'render ready' : 'render unavailable'
    }}</span>
    <span data-threadplane-compatibility="telemetry">{{
      packageReady('telemetry') ? 'telemetry ready' : 'telemetry unavailable'
    }}</span>
  </aside>`,
  styles: [
    `
      :host {
        display: block;
        font: 10px/1.2 monospace;
        padding: 2px 4px;
      }
      span + span {
        margin-left: 4px;
      }
    `,
  ],
})
class CompatibilityProbeComponent {
  private readonly agUiAgent = injectAgUiAgent();
  protected readonly agUiReady = Boolean(this.agUiAgent);
  private readonly packageRefs = Object.fromEntries(PACKAGE_REFS) as Record<
    string,
    unknown
  >;

  protected packageReady(name: string) {
    return Boolean(this.packageRefs[name]);
  }
}

export function bootstrapCompatibilityProbe() {
  const host = document.createElement('threadplane-compatibility-probe');
  document.body.append(host);

  return bootstrapApplication(CompatibilityProbeComponent, {
    providers: [
      provideZonelessChangeDetection(),
      ...provideFakeAgent({ tokens: ['compatibility'] }),
    ],
  });
}
