// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectAgent } from '@threadplane/ag-ui';
import { ChatComponent } from '@threadplane/chat';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatComponent],
  templateUrl: './app.html',
})
export class App {
  protected readonly agent = injectAgent();
}
