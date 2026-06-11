// SPDX-License-Identifier: MIT
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AgUiShell } from './shell/ag-ui-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgUiShell],
  templateUrl: './app.html',
})
export class App {}
